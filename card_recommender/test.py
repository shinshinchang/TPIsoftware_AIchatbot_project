import os
from dotenv import load_dotenv
from openai import OpenAI

# Load the API key from your .env file
load_dotenv()
nvidia_api_key = os.getenv("NVIDIA_API_KEY")

# Initialize the client pointing to NVIDIA's endpoint
client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=nvidia_api_key
)

def chat_with_nvidia():
    try:
        # You can swap this for other models available on the NVIDIA API
        model_name = "minimaxai/minimax-m2.7" 
        
        response = client.chat.completions.create(
            model=model_name,
            messages=[
                {"role": "system", "content": "You are a helpful data science assistant."},
                {"role": "user", "content": "Explain what an alpha factor is in algorithmic trading in two sentences."}
            ],
            temperature=0.2,
            top_p=0.7,
            max_tokens=1024,
            stream=False
        )
        
        print(response.choices[0].message.content)
        
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    chat_with_nvidia()