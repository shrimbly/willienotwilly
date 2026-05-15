#!/usr/bin/env bash
# Encode portfolio videos to web-optimized H.264. Preserves source fps.
# Outputs:
#   public/videos/portfolio/encoded/<name>.mp4
#   public/images/portfolio/posters/<name>.jpg
# Does NOT overwrite originals.

set -u

SRC_DIR="public/videos/portfolio"
OUT_DIR="public/videos/portfolio/encoded"
POSTER_DIR="public/images/portfolio/posters"

mkdir -p "$OUT_DIR" "$POSTER_DIR"

REPORT="$OUT_DIR/_report.txt"
: > "$REPORT"

# CRF + max-edge per tier (CRF 23 across the board)
crf_for() {
  case "$1" in
    hero) echo "23 1920 1080" ;;
    card) echo "23 1920 1080" ;;
    highlight) echo "23 1920 1080" ;;
    small) echo "23 1280 720" ;;
  esac
}

tier_for() {
  case "$1" in
    banana.mp4|contact-sheet.mp4|ezpz.mp4|flip.mp4|reflct-hero.mp4|sharp.mp4) echo "hero" ;;
    reflct-1-1.mp4|try-galaxy-card.mp4) echo "card" ;;
    reflct-shopify-square.mp4|reflct-shopify-wide.mp4) echo "small" ;;
    contact-kinetic-type.mp4|flipper-demo.mp4|nd-ease.mp4|nd-fallback.mp4|nd-variables2.mp4|reflct-camera.mp4|reflct-viewer.mp4|sf-tui.mp4) echo "highlight" ;;
    *) echo "skip" ;;
  esac
}

probe_fps() {
  ffprobe -v error -select_streams v:0 -show_entries stream=r_frame_rate -of default=nw=1:nk=1 "$1" \
    | awk -F'/' '{ if ($2 != 0) printf "%.0f", $1/$2; else print $1 }'
}

human_size() { ls -lh "$1" 2>/dev/null | awk '{print $5}'; }

echo "== Portfolio video encoder ==" | tee -a "$REPORT"
echo "Started: $(date)" | tee -a "$REPORT"
echo "" | tee -a "$REPORT"
printf "%-32s  %-9s  %5s  %7s -> %7s  %s\n" "FILE" "TIER" "FPS" "BEFORE" "AFTER" "NOTE" | tee -a "$REPORT"
printf -- "%.0s-" {1..96}; echo "" | tee -a "$REPORT"

for src in "$SRC_DIR"/*.mp4; do
  name=$(basename "$src")
  [[ "$name" == _* ]] && continue

  tier=$(tier_for "$name")
  if [[ "$tier" == "skip" ]]; then
    printf "%-32s  %-9s  %5s  %7s    %-7s  %s\n" "$name" "(skip)" "-" "$(human_size "$src")" "-" "unreferenced or orphan" | tee -a "$REPORT"
    continue
  fi

  read -r crf max_w max_h <<<"$(crf_for "$tier")"
  fps=$(probe_fps "$src")
  fps_note=""
  if [[ "$fps" == "60" ]]; then
    fps_note="60fps preserved"
  fi

  out="$OUT_DIR/$name"
  poster="$POSTER_DIR/${name%.mp4}.jpg"

  before=$(human_size "$src")

  # encode (no -r flag → source fps preserved)
  if ! ffmpeg -y -hide_banner -loglevel error -i "$src" \
    -c:v libx264 -preset slow -crf "$crf" \
    -profile:v high -pix_fmt yuv420p \
    -vf "scale=${max_w}:${max_h}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2" \
    -an -movflags +faststart \
    "$out"; then
    printf "%-32s  %-9s  %5s  %7s    %-7s  %s\n" "$name" "$tier" "$fps" "$before" "FAIL" "encode error" | tee -a "$REPORT"
    continue
  fi

  # poster frame at 0.5s, matching scaled dimensions
  ffmpeg -y -hide_banner -loglevel error -ss 0.5 -i "$src" -frames:v 1 \
    -vf "scale=${max_w}:${max_h}:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2" \
    -q:v 4 "$poster" 2>/dev/null

  after=$(human_size "$out")
  printf "%-32s  %-9s  %5s  %7s -> %7s  %s\n" "$name" "$tier" "$fps" "$before" "$after" "$fps_note" | tee -a "$REPORT"
done

echo "" | tee -a "$REPORT"
echo "Done: $(date)" | tee -a "$REPORT"
echo "" | tee -a "$REPORT"
echo "Originals total:  $(du -sh "$SRC_DIR" --exclude='encoded' 2>/dev/null | awk '{print $1}' || du -sh "$SRC_DIR" | awk '{print $1}')" | tee -a "$REPORT"
echo "Encoded total:    $(du -sh "$OUT_DIR" 2>/dev/null | awk '{print $1}')" | tee -a "$REPORT"
echo "Posters total:    $(du -sh "$POSTER_DIR" 2>/dev/null | awk '{print $1}')" | tee -a "$REPORT"
