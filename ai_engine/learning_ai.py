import os
import wikipedia
from groq import Groq
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

# Verify API key
api_key = os.getenv("GROQ_API_KEY")
if not api_key:
    print("Warning: GROQ_API_KEY not found in environment variables.")

# Initialize Groq client
client = Groq(
    api_key=api_key,
)

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

    max_retries = 3
    base_delay = 2

    for attempt in range(max_retries):
        try:
            chat_completion = client.chat.completions.create(
                messages=[
                    {
                        "role": "user",
                        "content": prompt,
                    }
                ],
                model="llama-3.3-70b-versatile", # Using robust Llama 3.3 model
                temperature=0.2,
            )
            return chat_completion.choices[0].message.content
        except Exception as e:
            # Rate limit handling
            if "429" in str(e) or "quota" in str(e).lower():
                if attempt < max_retries - 1:
                    wait_time = base_delay * (2 ** attempt)
                    print(f"Rate limit hit. Retrying in {wait_time} s...")
                    import time
                    time.sleep(wait_time)
                    continue
                else:
                    return f"Error: Rate limit exceeded. Details: {e}"
            return f"Error generating content: {e}"

if __name__ == "__main__":
    result = generate_content(
        "Photosynthesis",
        "Beginner",
        "CBSE Class 7",
        "Understand photosynthesis"
    )
    print(result)
