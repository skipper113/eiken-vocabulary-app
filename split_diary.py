#!/usr/bin/env python3
import re

def count_bold_words(text):
    """Count bold words in text"""
    return len(re.findall(r'\*\*([^*]+)\*\*', text))

def split_into_parts(day_content, day_num, day_title, target_words=15, max_words=20):
    """Split a day's content into parts with target number of words"""
    # Split into paragraphs
    paragraphs = day_content.split('\n\n')
    
    parts = []
    current_part = []
    current_word_count = 0
    
    for i, para in enumerate(paragraphs):
        if para.strip() == '' or para.startswith('---'):
            continue
            
        para_word_count = count_bold_words(para)
        
        # If adding this paragraph would exceed max_words, start a new part
        if current_word_count > 0 and current_word_count + para_word_count > max_words:
            # Save current part only if it has enough words
            if current_word_count >= 10:
                parts.append('\n\n'.join(current_part))
                current_part = [para]
                current_word_count = para_word_count
            else:
                # Current part too small, add this paragraph anyway
                current_part.append(para)
                current_word_count += para_word_count
        else:
            current_part.append(para)
            current_word_count += para_word_count
            
            # If we've reached target words, consider ending the part
            if current_word_count >= target_words:
                # Check if next paragraph exists and is small
                if i + 1 < len(paragraphs):
                    next_para = paragraphs[i + 1]
                    if not next_para.startswith('---'):
                        next_para_count = count_bold_words(next_para)
                        # If next para is small and won't exceed max, continue
                        if next_para_count < 5 and current_word_count + next_para_count <= max_words:
                            continue
                        # If adding next would exceed max, end this part
                        elif current_word_count + next_para_count > max_words:
                            parts.append('\n\n'.join(current_part))
                            current_part = []
                            current_word_count = 0
                else:
                    # Last paragraph, end part
                    if current_word_count >= 10:
                        parts.append('\n\n'.join(current_part))
                        current_part = []
                        current_word_count = 0
    
    # Add remaining content if it has enough words
    if current_part and current_word_count >= 8:  # Lower threshold for final part
        parts.append('\n\n'.join(current_part))
    elif current_part and parts:  # Merge with previous if too small
        parts[-1] += '\n\n' + '\n\n'.join(current_part)
    
    # Format parts with proper headers
    formatted_parts = []
    if len(parts) == 1:
        # No need to split
        formatted_parts.append(f"## Day {day_num} - {day_title}\n\n{parts[0]}")
    else:
        for i, part in enumerate(parts, 1):
            part_title = f"## Day {day_num} - {day_title} (Part {i})"
            formatted_parts.append(f"{part_title}\n\n{part}")
    
    return formatted_parts

def process_diary(input_file, output_file):
    """Process the entire diary file"""
    with open(input_file, 'r') as f:
        content = f.read()
    
    # Split by days
    days = re.split(r'^## Day ', content, flags=re.MULTILINE)[1:]
    
    new_content = []
    new_content.append("# Mina's K-pop Training Diary - A 30-Day Journey\n\n")
    
    total_parts = 0
    
    for day_content in days:
        lines = day_content.split('\n', 1)
        day_header = lines[0]
        
        # Extract day number and title
        match = re.match(r'(\d+) - (.+)', day_header)
        if match:
            day_num = match.group(1)
            day_title = match.group(2)
        else:
            continue
        
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
            word_count = count_bold_words(actual_content)
            
            if word_count <= 20:
                # No need to split
                new_content.append(f"## Day {day_num} - {day_title}\n{actual_content}\n\n---\n\n")
                total_parts += 1
                print(f"Day {day_num}: {word_count} words - kept as is")
            else:
                # Split into parts
                parts = split_into_parts(actual_content, day_num, day_title)
                for part in parts:
                    word_count = count_bold_words(part)
                    new_content.append(part + "\n\n---\n\n")
                    total_parts += 1
                print(f"Day {day_num}: Split into {len(parts)} parts")
    
    # Write output
    with open(output_file, 'w') as f:
        f.write(''.join(new_content))
    
    print(f"\nTotal parts created: {total_parts}")
    print(f"Output written to: {output_file}")

if __name__ == "__main__":
    process_diary('/Users/yohei/eiken2/mina_kpop_diary.md', 
                  '/Users/yohei/eiken2/mina_kpop_diary_split.md')