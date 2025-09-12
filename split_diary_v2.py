#!/usr/bin/env python3
import re

def count_bold_words(text):
    """Count bold words in text"""
    return len(re.findall(r'\*\*([^*]+)\*\*', text))

def count_total_words(text):
    """Count total words in text (not just bold)"""
    return len(text.split())

def split_paragraphs_by_limit(paragraphs, max_total_words=250, target_bold_words=15):
    """Split paragraphs into parts respecting word limits"""
    parts = []
    current_part = []
    current_bold_count = 0
    current_total_words = 0
    
    for para in paragraphs:
        if para.strip() == '' or para.startswith('---'):
            continue
            
        para_bold_count = count_bold_words(para)
        para_total_words = count_total_words(para)
        
        # Check if adding this paragraph would exceed limits
        if current_total_words > 0 and current_total_words + para_total_words > max_total_words:
            # Save current part if it has enough content
            if current_bold_count >= 5 or current_total_words >= 50:
                parts.append('\n\n'.join(current_part))
            else:
                # Too small, merge with previous if possible
                if parts and count_total_words(parts[-1]) + current_total_words <= max_total_words:
                    parts[-1] += '\n\n' + '\n\n'.join(current_part)
                else:
                    parts.append('\n\n'.join(current_part))
            
            # Start new part
            current_part = [para]
            current_bold_count = para_bold_count
            current_total_words = para_total_words
        else:
            # Add to current part
            current_part.append(para)
            current_bold_count += para_bold_count
            current_total_words += para_total_words
            
            # Check if we should end this part
            if (current_bold_count >= target_bold_words and current_total_words >= 150) or current_total_words >= 200:
                parts.append('\n\n'.join(current_part))
                current_part = []
                current_bold_count = 0
                current_total_words = 0
    
    # Add remaining content
    if current_part:
        if current_bold_count >= 5 or current_total_words >= 50:
            parts.append('\n\n'.join(current_part))
        elif parts:
            # Try to merge with previous
            if count_total_words(parts[-1]) + current_total_words <= max_total_words:
                parts[-1] += '\n\n' + '\n\n'.join(current_part)
            else:
                parts.append('\n\n'.join(current_part))
    
    return parts

def process_diary(input_file, output_file):
    """Process the entire diary file"""
    with open(input_file, 'r') as f:
        content = f.read()
    
    # Parse all entries
    pattern = r'## Day (\d+) - ([^\n]+)\n+([\s\S]*?)(?=\n---|\n## Day \d+|$)'
    matches = re.findall(pattern, content, re.MULTILINE)
    
    # Group entries by day number
    days_data = {}
    for day_num_str, title, text in matches:
        day_num = int(day_num_str)
        if day_num not in days_data:
            days_data[day_num] = []
        
        # Extract base title (remove part numbers)
        base_title = re.sub(r'\s*\(Part \d+\)$', '', title)
        
        days_data[day_num].append({
            'title': base_title,
            'text': text.strip()
        })
    
    # Process each day
    new_content = []
    new_content.append("# Mina's K-pop Training Diary - A 30-Day Journey\n\n")
    total_parts = 0
    
    for day_num in sorted(days_data.keys()):
        entries = days_data[day_num]
        base_title = entries[0]['title']  # Use the first entry's title as base
        
        # Combine all text for this day
        all_paragraphs = []
        for entry in entries:
            if entry['text'].strip():  # Only add non-empty text
                paragraphs = entry['text'].split('\n\n')
                all_paragraphs.extend([p for p in paragraphs if p.strip()])
        
        if not all_paragraphs:
            print(f"Day {day_num}: No content found, skipping")
            continue
        
        # Split into parts respecting word limits
        parts = split_paragraphs_by_limit(all_paragraphs)
        
        # Output parts with proper numbering
        if len(parts) == 1:
            # Single part - no part number needed
            new_content.append(f"## Day {day_num} - {base_title}\n\n{parts[0]}\n\n---\n\n")
            total_words = count_total_words(parts[0])
            bold_words = count_bold_words(parts[0])
            print(f"Day {day_num}: {bold_words} bold, {total_words} total words")
            total_parts += 1
        else:
            # Multiple parts
            print(f"Day {day_num}: {len(parts)} parts")
            for i, part_text in enumerate(parts, 1):
                new_content.append(f"## Day {day_num} - {base_title} (Part {i})\n\n{part_text}\n\n---\n\n")
                total_words = count_total_words(part_text)
                bold_words = count_bold_words(part_text)
                print(f"  Part {i}: {bold_words} bold, {total_words} total words")
                total_parts += 1
    
    # Write output
    with open(output_file, 'w') as f:
        f.write(''.join(new_content))
    
    print(f"\nTotal parts created: {total_parts}")
    print(f"Output written to: {output_file}")

if __name__ == "__main__":
    process_diary('/Users/yohei/eiken2/mina_kpop_diary.md', 
                  '/Users/yohei/eiken2/mina_kpop_diary_split.md')