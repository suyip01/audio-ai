from pathlib import Path
from openai import OpenAI
import time

client = OpenAI(
   api_key="QErFh7EwE7ywHowY12866dCf-f9b5-42Cf-b71E-205f5eAa",
   base_url="https://api.modelverse.cn/v1/",
)

speech_file_path = Path(__file__).parent / "generated-speech.wav"

import time

start_time = time.time()
with client.audio.speech.with_streaming_response.create(
   model="IndexTeam/IndexTTS-2",
   voice="novel",
   input="To enhance speech clarity in highly emotional expressions, we incorporate GPT latent representations and design a novel three-stage training paradigm to improve the stability of the generated speech. Additionally, to lower the barrier for emotional control, we designed a soft instruction mechanism based on text descriptions by fine-tuning Qwen3, effectively guiding the generation of speech with the desired emotional orientation.",
) as response:
   response.stream_to_file(speech_file_path)
end_time = time.time()

print(f"Audio saved to {speech_file_path}")
print(f"Time taken to generate speech: {end_time - start_time:.2f} seconds")
