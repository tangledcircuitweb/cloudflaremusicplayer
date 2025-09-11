#!/bin/bash

INPUT_DIR="/home/tangledcircuit/Music/epicscripture"
OUTPUT_DIR="/home/tangledcircuit/Music/epicscripture_optimized"

# Create output directory
mkdir -p "$OUTPUT_DIR"

echo "Optimizing WAV files to Spotify quality (320kbps MP3)..."
echo "Input: $INPUT_DIR"
echo "Output: $OUTPUT_DIR"

count=0
total=$(ls "$INPUT_DIR"/*.wav | wc -l)

for input_file in "$INPUT_DIR"/*.wav; do
    if [ -f "$input_file" ]; then
        count=$((count + 1))
        filename=$(basename "$input_file" .wav)
        output_file="$OUTPUT_DIR/${filename}.mp3"
        
        echo "[$count/$total] Processing: $filename"
        
        # Spotify quality: 320kbps MP3, 44.1kHz, stereo
        ffmpeg -i "$input_file" -acodec libmp3lame -b:a 320k -ar 44100 -ac 2 "$output_file" -y -loglevel error
        
        if [ $? -eq 0 ]; then
            input_size=$(stat -c%s "$input_file")
            output_size=$(stat -c%s "$output_file")
            reduction=$((100 - (output_size * 100 / input_size)))
            echo "✅ $filename - Size reduced by ${reduction}%"
        else
            echo "❌ Failed: $filename"
        fi
    fi
done

echo ""
echo "Optimization complete!"
echo "Original files: $(du -sh "$INPUT_DIR" | cut -f1)"
echo "Optimized files: $(du -sh "$OUTPUT_DIR" | cut -f1)"
echo ""
echo "To upload optimized files:"
echo "1. Update upload script: sed -i 's|/Music/epicscripture|/Music/epicscripture_optimized|' upload_psalms.sh"
echo "2. Run: ./upload_psalms.sh"
