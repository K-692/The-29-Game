import os
import subprocess
from PIL import Image
import numpy as np
from scipy import ndimage

def main():
    eps_path = "poker-cards-icons-collection/OIUGSZ1.eps"
    out_dir = "public/assets/cards"
    os.makedirs(out_dir, exist_ok=True)

    print("Step 1: Rendering EPS at 1440 DPI (9000x9000 px) using Ghostscript...")
    render_path = "temp_eps_1440.png"
    cmd = [
        "gs", "-dNOPAUSE", "-dBATCH",
        "-sDEVICE=png16m",
        "-dEPSCrop",
        "-r1440",
        f"-sOutputFile={render_path}",
        eps_path
    ]
    subprocess.run(cmd, check=True)

    print("Step 2: Loading high-res rendered sheet...")
    sheet = Image.open(render_path)
    sheet_w, sheet_h = sheet.size
    print(f"Sheet size: {sheet_w}x{sheet_h}")

    # Scale factor from 450 pt bounding box to 9000 px: exactly 20 px / pt
    scale = sheet_w / 450.0

    # Card grid column x bounds (in points)
    # Each card is approx 39.2 points wide
    col_bounds_pt = [
        (10.0, 49.5),   # 0: Diamonds (K, Q, J, 10, 9, 8)
        (58.9, 98.7),   # 1: Spades (K, Q, J, 10, 9, 8)
        (108.1, 147.8), # 2: Hearts (K, Q, J, 10, 9, 8)
        (157.2, 197.0), # 3: Clubs (K, Q, J, 10, 9, 8)
        (205.8, 244.5), # 4: Aces (0..3), Joker (4), Card Back (5)
        (253.2, 292.0), # 5: Diamonds (7)
        (302.3, 341.6), # 6: Spades (7)
        (351.2, 390.6), # 7: Hearts (7)
        (400.6, 439.9), # 8: Clubs (7)
    ]

    # Card grid row y bounds (in points)
    # Each card is approx 55.6 points high
    row_bounds_pt = [
        (54.4, 110.9),  # 0: Kings / 7s / Ace Clubs
        (120.4, 176.9), # 1: Queens / Ace Hearts
        (186.4, 242.9), # 2: Jacks / Ace Spades
        (252.3, 308.9), # 3: 10s / Ace Diamonds
        (318.3, 374.8), # 4: 9s / Joker
        (384.3, 440.8), # 5: 8s / Card Back
    ]

    # Card mapping dictionary for 32 cards of 29 + card back
    card_map = {
        # Jacks (3 points)
        "jack_of_diamonds": (0, 2),
        "jack_of_spades": (1, 2),
        "jack_of_hearts": (2, 2),
        "jack_of_clubs": (3, 2),
        
        # Nines (2 points)
        "nine_of_diamonds": (0, 4),
        "nine_of_spades": (1, 4),
        "nine_of_hearts": (2, 4),
        "nine_of_clubs": (3, 4),
        
        # Aces (1 point)
        "ace_of_diamonds": (4, 3),
        "ace_of_spades": (4, 2),
        "ace_of_hearts": (4, 1),
        "ace_of_clubs": (4, 0),
        
        # Tens (1 point)
        "ten_of_diamonds": (0, 3),
        "ten_of_spades": (1, 3),
        "ten_of_hearts": (2, 3),
        "ten_of_clubs": (3, 3),
        
        # Kings (0 points)
        "king_of_diamonds": (0, 0),
        "king_of_spades": (1, 0),
        "king_of_hearts": (2, 0),
        "king_of_clubs": (3, 0),
        
        # Queens (0 points)
        "queen_of_diamonds": (0, 1),
        "queen_of_spades": (1, 1),
        "queen_of_hearts": (2, 1),
        "queen_of_clubs": (3, 1),
        
        # Eights (0 points)
        "eight_of_diamonds": (0, 5),
        "eight_of_spades": (1, 5),
        "eight_of_hearts": (2, 5),
        "eight_of_clubs": (3, 5),
        
        # Sevens (0 points)
        "seven_of_diamonds": (5, 0),
        "seven_of_spades": (6, 0),
        "seven_of_hearts": (7, 0),
        "seven_of_clubs": (8, 0),
        
        # Geometric Card Back
        "card_back": (4, 5),
    }

    # Reference background green color to mask out: ~ [12, 99, 57]
    bg_green = np.array([12, 99, 57], dtype=float)

    print(f"Step 3: Extracting {len(card_map)} cards with alpha transparency...")

    for card_name, (c_idx, r_idx) in card_map.items():
        x0_pt, x1_pt = col_bounds_pt[c_idx]
        y0_pt, y1_pt = row_bounds_pt[r_idx]

        # Convert to pixel coordinates on the 1440 DPI sheet
        # Add slight margin to capture subtle shadow
        pad_pt = 0.4
        x0_px = int((x0_pt - pad_pt) * scale)
        x1_px = int((x1_pt + pad_pt) * scale)
        y0_px = int((y0_pt - pad_pt) * scale)
        y1_px = int((y1_pt + pad_pt) * scale)

        card_crop = sheet.crop((x0_px, y0_px, x1_px, y1_px))
        arr = np.array(card_crop.convert("RGBA"))

        # Color difference from background green
        diff = np.linalg.norm(arr[:, :, :3].astype(float) - bg_green, axis=2)
        is_bg = diff < 30

        # Flood fill from the outer 4 corners so interior green illustrations (if any) are preserved
        bg_seed = np.zeros(is_bg.shape, dtype=bool)
        bg_seed[0, 0] = True
        bg_seed[0, -1] = True
        bg_seed[-1, 0] = True
        bg_seed[-1, -1] = True

        outer_bg = ndimage.binary_dilation(bg_seed, iterations=80, mask=is_bg)
        while True:
            new_bg = ndimage.binary_dilation(outer_bg, iterations=40, mask=is_bg)
            if (new_bg == outer_bg).all():
                break
            outer_bg = new_bg

        # Build smooth alpha channel
        alpha = np.ones(arr.shape[:2], dtype=np.uint8) * 255
        alpha[outer_bg] = 0

        # Smooth boundary anti-aliasing
        alpha_smooth = ndimage.gaussian_filter(alpha.astype(float), sigma=0.8)
        arr[:, :, 3] = np.clip(alpha_smooth, 0, 255).astype(np.uint8)

        clean_img = Image.fromarray(arr)

        # Standard high-res card resolution: 500 x 700 px
        final_png = clean_img.resize((500, 700), Image.Resampling.LANCZOS)
        
        # Save high-res PNG
        png_path = os.path.join(out_dir, f"{card_name}.png")
        final_png.save(png_path, "PNG", optimize=True)

        # Save crisp SVG wrapping the lossless high-res card with crisp viewBox
        # Also embed the base64 or file reference so SVGs are 100% self-contained and render everywhere
        import base64
        import io
        buf = io.BytesIO()
        final_png.save(buf, format="PNG")
        b64_data = base64.b64encode(buf.getvalue()).decode("utf-8")

        svg_content = f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 500 700" width="100%" height="100%">
  <image width="500" height="700" href="data:image/png;base64,{b64_data}" />
</svg>'''
        svg_path = os.path.join(out_dir, f"{card_name}.svg")
        with open(svg_path, "w", encoding="utf-8") as f:
            f.write(svg_content)

        print(f"  ✓ {card_name:20s} -> PNG ({final_png.width}x{final_png.height}), SVG ({len(svg_content)} bytes)")

    # Clean up temporary rendered sheet
    if os.path.exists(render_path):
        os.remove(render_path)

    print("\nExtraction complete! All 32 cards + card back generated with 1440 DPI pristine vector fidelity.")

if __name__ == "__main__":
    main()
