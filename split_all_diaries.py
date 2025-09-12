#!/usr/bin/env python3
import re
import sys

def count_bold_words(text):
    """Count bold words in text"""
    return len(re.findall(r'\*\*([^*]+)\*\*', text))

def count_total_words(text):
    """Count total words in text (not just bold)"""
    return len(text.split())

def split_into_parts(day_content, day_num, day_title, target_words=15, max_words=20):
    """Split a day's content into parts with target number of words and hard limit on total words"""
    # Split into paragraphs
    paragraphs = day_content.split('\n\n')
    
    parts = []
    current_part = []
    current_bold_count = 0
    current_total_words = 0  # Track total word count for hard limit
    
    for i, para in enumerate(paragraphs):
        if para.strip() == '' or para.startswith('---'):
            continue
            
        para_bold_count = count_bold_words(para)
        para_total_words = count_total_words(para)
        
        # Hard limit: if adding this paragraph would exceed 250 total words, start new part
        if current_total_words > 0 and current_total_words + para_total_words > 250:
            # Save current part
            if current_bold_count >= 5:  # At least 5 target words
                parts.append('\n\n'.join(current_part))
                current_part = [para]
                current_bold_count = para_bold_count
                current_total_words = para_total_words
            else:
                # Current part has too few target words, but we must split due to length
                # Try to split the paragraph itself if it's too long
                if para_total_words > 150:
                    # Split paragraph at sentence level
                    sentences = para.replace('. ', '.|').split('|')
                    para_part1 = []
                    para_part2 = []
                    words_so_far = current_total_words
                    
                    for sent in sentences:
                        if words_so_far + count_total_words(sent) <= 250:
                            para_part1.append(sent)
                            words_so_far += count_total_words(sent)
                        else:
                            para_part2.append(sent)
                    
                    if para_part1:
                        current_part.append(''.join(para_part1))
                        parts.append('\n\n'.join(current_part))
                    
                    # Start new part with remaining sentences
                    if para_part2:
                        current_part = [''.join(para_part2)]
                        current_bold_count = count_bold_words(''.join(para_part2))
                        current_total_words = count_total_words(''.join(para_part2))
                    else:
                        current_part = []
                        current_bold_count = 0
                        current_total_words = 0
                else:
                    # Paragraph not too long by itself, just save and start new
                    parts.append('\n\n'.join(current_part))
                    current_part = [para]
                    current_bold_count = para_bold_count
                    current_total_words = para_total_words
        else:
            current_part.append(para)
            current_bold_count += para_bold_count
            current_total_words += para_total_words
            
            # Check if we should end this part
            if current_bold_count >= target_words or current_total_words >= 200:
                # Check next paragraph
                if i + 1 < len(paragraphs):
                    next_para = paragraphs[i + 1]
                    if not next_para.startswith('---'):
                        next_total_words = count_total_words(next_para)
                        # Only continue if it won't exceed 250 word hard limit
                        if current_total_words + next_total_words > 250:
                            # End this part
                            parts.append('\n\n'.join(current_part))
                            current_part = []
                            current_bold_count = 0
                            current_total_words = 0
                else:
                    # Last paragraph
                    parts.append('\n\n'.join(current_part))
                    current_part = []
                    current_bold_count = 0
                    current_total_words = 0
    
    # Add remaining content
    if current_part and (current_bold_count >= 5 or current_total_words >= 50):
        parts.append('\n\n'.join(current_part))
    elif current_part and parts:  # Merge with previous if too small
        # But check it won't exceed 250 words
        last_part_words = count_total_words(parts[-1])
        current_words = count_total_words('\n\n'.join(current_part))
        if last_part_words + current_words <= 250:
            parts[-1] += '\n\n' + '\n\n'.join(current_part)
    
    # Format parts with proper headers
    formatted_parts = []
    if len(parts) == 1:
        # No need to split - clean up the content
        content = parts[0].strip()
        formatted_parts.append(f"## Day {day_num} - {day_title}\n\n{content}")
    else:
        # Check if title already has part numbers
        has_existing_parts = '(Part' in day_title
        
        if has_existing_parts:
            # Extract base title without part number
            base_title = re.sub(r'\s*\(Part \d+\)$', '', day_title)
            # Count which part this is within the day
            # We need to track this globally
            for i, part in enumerate(parts, 1):
                # Create new part number based on global tracking
                part_title = f"## Day {day_num} - {base_title} (Part {i})"
                content = part.strip()
                formatted_parts.append(f"{part_title}\n\n{content}")
        else:
            for i, part in enumerate(parts, 1):
                part_title = f"## Day {day_num} - {day_title} (Part {i})"
                content = part.strip()
                formatted_parts.append(f"{part_title}\n\n{content}")
    
    return formatted_parts

def process_diary(input_file, output_file, diary_title):
    """Process the entire diary file"""
    with open(input_file, 'r') as f:
        content = f.read()
    
    # Split by days
    days = re.split(r'^## Day ', content, flags=re.MULTILINE)[1:]
    
    new_content = []
    new_content.append(f"# {diary_title}\n\n")
    
    total_parts = 0
    day_parts_counter = {}  # Track part numbers for each day
    
    for day_content in days:
        lines = day_content.split('\n', 1)
        day_header = lines[0]
        
        # Extract day number and title
        match = re.match(r'(\d+) - (.+)', day_header)
        if match:
            day_num = match.group(1)
            full_title = match.group(2)
            
            # Check if this already has a part number
            part_match = re.match(r'(.+?)\s*\(Part \d+\)$', full_title)
            if part_match:
                base_title = part_match.group(1)
            else:
                base_title = full_title
        else:
            continue
        
        # Initialize part counter for this day if needed
        if day_num not in day_parts_counter:
            day_parts_counter[day_num] = 0
        
        # Get the actual content (skip the header line)
        if len(lines) > 1:
            actual_content = lines[1]
            
            # Find the end of this day's content
            next_day_idx = actual_content.find('\n## Day ')
            end_idx = actual_content.find('\n---')
            
            if next_day_idx > 0:
                actual_content = actual_content[:next_day_idx]
            elif end_idx > 0:
                actual_content = actual_content[:end_idx]
            
            # Count words
            bold_count = count_bold_words(actual_content)
            total_words = count_total_words(actual_content)
            
            if bold_count <= 20 and total_words <= 250:
                # No need to split
                day_parts_counter[day_num] += 1
                if day_parts_counter[day_num] > 1:
                    # This day has multiple parts
                    new_content.append(f"## Day {day_num} - {base_title} (Part {day_parts_counter[day_num]})\n{actual_content}\n\n---\n\n")
                else:
                    new_content.append(f"## Day {day_num} - {base_title}\n{actual_content}\n\n---\n\n")
                total_parts += 1
                print(f"Day {day_num} Part {day_parts_counter[day_num]}: {bold_count} bold, {total_words} total words")
            else:
                # Split into parts
                parts = split_into_parts(actual_content, day_num, base_title)
                print(f"Day {day_num}: Splitting into {len(parts)} parts")
                for part in parts:
                    day_parts_counter[day_num] += 1
                    # Replace the part number in the generated header
                    # The split_into_parts function returns headers like "## Day X - Title (Part Y)"
                    # We need to update Y to be the correct global part number
                    part_lines = part.split('\n', 1)
                    if len(part_lines) > 1:
                        # Always add part number when there are multiple parts for a day
                        new_header = f"## Day {day_num} - {base_title} (Part {day_parts_counter[day_num]})"
                        updated_part = new_header + '\n' + part_lines[1]
                    else:
                        updated_part = part
                    
                    # Count words in the actual content
                    content_lines = updated_part.split('\n', 2)
                    if len(content_lines) > 2:
                        content_only = content_lines[2]
                    else:
                        content_only = updated_part
                    bold_count = count_bold_words(content_only)
                    actual_total = count_total_words(content_only)
                    
                    new_content.append(updated_part + "\n\n---\n\n")
                    total_parts += 1
                    print(f"  Part {day_parts_counter[day_num]}: {bold_count} bold, {actual_total} total words")
    
    # Write output
    with open(output_file, 'w') as f:
        f.write(''.join(new_content))
    
    print(f"\nTotal parts created: {total_parts}")
    print(f"Output written to: {output_file}")

if __name__ == "__main__":
    # Process all diary files
    diaries = [
        {
            'input': '/Users/yohei/eiken2/kai_titan_diary.md',
            'output': '/Users/yohei/eiken2/kai_titan_diary_split.md',
            'title': "Kai's Attack on Titan Adventure - Eiken 3 Journey"
        },
        {
            'input': '/Users/yohei/eiken2/ayaka_ib_diary.md',
            'output': '/Users/yohei/eiken2/ayaka_ib_diary_split.md',
            'title': "Ayaka's IB School Journey - Eiken Pre-1 Adventure"
        },
        {
            'input': '/Users/yohei/eiken2/reiko_anomaly_diary.md',
            'output': '/Users/yohei/eiken2/reiko_anomaly_diary_split.md',
            'title': "Reiko's Anomaly Investigation - Eiken 1 Mystery"
        }
    ]
    
    for diary in diaries:
        print(f"\n{'='*60}")
        print(f"Processing: {diary['input']}")
        print('='*60)
        process_diary(diary['input'], diary['output'], diary['title'])