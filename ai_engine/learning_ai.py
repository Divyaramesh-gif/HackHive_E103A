import os
import wikipedia
import google.generativeai as genai
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Verify API key
api_key = os.getenv("GOOGLE_API_KEY")
if not api_key:
    print("Warning: GOOGLE_API_KEY not found in environment variables. Please set it in a .env file.")
else:
    genai.configure(api_key=api_key)

def get_verified_fact(topic):
    try:
        return wikipedia.summary(topic, sentences=3)
    except wikipedia.exceptions.DisambiguationError as e:
        return f"Topic is ambiguous. Options: {e.options[:5]}"
    except wikipedia.exceptions.PageError:
        return "Topic not found on Wikipedia."
    except Exception as e:
        return f"Error retrieving facts: {e}"

def generate_content(topic, level, curriculum, objective):
    facts = get_verified_fact(topic)

    prompt = f"""
You are a learning-aware AI system.

Topic: {topic}
Curriculum: {curriculum}
Level: {level}
Learning Objective: {objective}

Use ONLY the facts below. Do not invent anything.

Facts:
{facts}

Give:
1. Simple Explanation
2. Example
3. One Practice Question
"""

    # Retry logic for transient errors
    max_retries = 3
    base_delay = 2

    for attempt in range(max_retries):
        try:
            model = genai.GenerativeModel('gemini-2.0-flash')
            response = model.generate_content(prompt)
            return response.text
        except Exception as e:
             # Check for Quota/Rate Limit errors (common with free tier)
            if "429" in str(e) or "quota" in str(e).lower() or "resource" in str(e).lower():
                if attempt < max_retries - 1:
                    wait_time = base_delay * (2 ** attempt)
                    print(f"Rate limit or quota hit. Retrying in {wait_time} seconds...")
                    import time
                    time.sleep(wait_time)
                    continue
                else:
                    return f"Error: Rate limit or quota exceeded after {max_retries} retries. please check your Google Cloud/AI Studio quota. Details: {e}"
            return f"Error generating content: {e}"

if __name__ == "__main__":
    result = generate_content(
        "Photosynthesis",
        "Beginner",
        "CBSE Class 7",
        "Understand photosynthesis"
    )
    print(result)
