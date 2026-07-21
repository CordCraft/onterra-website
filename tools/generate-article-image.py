# -*- coding: utf-8 -*-
"""
Onterra, on-demand article image generator (fal.ai FLUX).

You run this BY CHOICE when writing one of your own articles.
It is not wired into anything automatic and costs nothing until you run it.

One-time setup:
  1. Create a file named  .env  in the onterra-website folder (same level as
     index.html) containing one line:
         FAL_KEY=your-fal-api-key-here
     (.env is gitignored, the key never reaches GitHub.)

Usage (from the onterra-website folder):
  python tools/generate-article-image.py "Why marginal fields are the smart play"
  python tools/generate-article-image.py "Coiled tubing explained" --style "coiled tubing unit on a wellpad at dusk"
  python tools/generate-article-image.py "My title" --model schnell   (cheaper, faster, slightly lower quality)

Output:
  images/insights/<slug>.jpg  plus the exact path to paste into the
  image field of the /admin editor.
"""
import argparse
import json
import os
import re
import sys
import urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

def load_key():
    key = os.environ.get("FAL_KEY", "").strip()
    if not key:
        env_path = os.path.join(ROOT, ".env")
        if os.path.exists(env_path):
            for line in open(env_path, encoding="utf-8"):
                if line.strip().startswith("FAL_KEY="):
                    key = line.split("=", 1)[1].strip().strip('"').strip("'")
    if not key:
        sys.exit("No FAL_KEY found. Put FAL_KEY=... in a .env file next to index.html, "
                 "or set the FAL_KEY environment variable.")
    return key

def slugify(s):
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s[:60] or "article"

HOUSE_STYLE = (
    "Cinematic professional photograph for an oil and gas industry publication. "
    "Nigerian upstream petroleum context. Moody dark navy blue and deep teal "
    "tones with warm amber highlights, dramatic late evening light, shallow "
    "depth of field, high detail, editorial quality, no text, no watermark, "
    "no people's faces in close-up."
)

def main():
    ap = argparse.ArgumentParser(description="Generate a branded article image via fal.ai")
    ap.add_argument("title", help="Article title (drives the image subject)")
    ap.add_argument("--style", default="", help="Extra scene description, overrides the guess from the title")
    ap.add_argument("--model", default="dev", choices=["dev", "schnell"],
                    help="flux model: dev = best quality (~$0.025), schnell = fast/cheap (~$0.003)")
    args = ap.parse_args()

    key = load_key()
    subject = args.style if args.style else args.title
    prompt = f"{HOUSE_STYLE} Subject: {subject}."

    endpoint = f"https://fal.run/fal-ai/flux/{args.model}"
    body = json.dumps({
        "prompt": prompt,
        "image_size": "landscape_16_9",
        "num_images": 1,
    }).encode()

    print(f"Generating with flux/{args.model} …")
    req = urllib.request.Request(endpoint, data=body, method="POST", headers={
        "Authorization": f"Key {key}",
        "Content-Type": "application/json",
    })
    try:
        with urllib.request.urlopen(req, timeout=120) as r:
            data = json.loads(r.read())
    except urllib.error.HTTPError as e:
        sys.exit(f"fal.ai error {e.code}: {e.read().decode()[:400]}")

    images = data.get("images") or []
    if not images:
        sys.exit(f"No image in response: {json.dumps(data)[:400]}")

    url = images[0]["url"]
    out_dir = os.path.join(ROOT, "images", "insights")
    os.makedirs(out_dir, exist_ok=True)
    out_path = os.path.join(out_dir, slugify(args.title) + ".jpg")
    urllib.request.urlretrieve(url, out_path)

    rel = "images/insights/" + os.path.basename(out_path)
    print("\nSaved:", out_path)
    print("\nNext steps:")
    print("  1. Commit and push (or let Claude do it):")
    print('       git add "%s" && git commit -m "article image" && git push' % rel)
    print("  2. In the /admin editor, set the article's Image field to:")
    print("       /" + rel)

if __name__ == "__main__":
    main()
