import time
import re
import io
import base64
from openai import OpenAI
from pydub import AudioSegment

# --- 全局配置 ---
S_time = time.time()

# 初始化 OpenAI 客户端
client = OpenAI(
    api_key="ucloud2025",
    base_url="http://117.50.199.239:8000/v1"
)

# --- 工具函数 ---

def split_audio(audio_path, chunk_duration=30):
    """将音频分割成指定时长（秒）的片段"""
    print(f"正在加载音频文件: {audio_path}")
    audio = AudioSegment.from_file(audio_path)
    duration_ms = len(audio)
    chunk_ms = chunk_duration * 1000
    chunks = []
    
    for i in range(0, duration_ms, chunk_ms):
        chunk = audio[i:i+chunk_ms]
        chunks.append(chunk)
    
    print(f"音频分割完成，共得到 {len(chunks)} 个片段。")
    return chunks

def audio_chunk_to_base64(chunk, format="wav"):
    """将音频片段转换为Base64编码的字符串"""
    buffer = io.BytesIO()
    chunk.export(buffer, format=format)
    audio_bytes = buffer.getvalue()
    return base64.b64encode(audio_bytes).decode("utf-8")

def extract_content(text):
    """提取单引号之间的内容，如果没有单引号则返回原文本"""
    if not text:
        return text
    match = re.search(r"'([^']*)'", text)
    return match.group(1) if match else text

# --- 核心逻辑 (流式版本) ---

def transcribe_audio_chunk_stream(chunk: AudioSegment, prompt: str) -> str:
    """
    使用 OpenAI SDK 流式转录单个音频片段。
    """
    print("开始流式转录...")
    full_transcription = ""
    try:
        audio_b64_str = audio_chunk_to_base64(chunk)
        
        messages = [
            {
                "role": "user",
                "content": [
                    {"type": "text", "text": prompt},
                    {
                        "type": "input_audio",
                        "input_audio": {
                            "data": audio_b64_str,
                            "format": "wav"
                        }
                    }
                ]
            }
        ]

        # 关键修改：设置 stream=True
        stream = client.chat.completions.create(
            model="Qwen2-Audio-7B-Instruct",
            messages=messages,
            max_tokens=1000,
            temperature=0.1,
            stream=True,  # 开启流式传输
        )
        
        # 迭代处理流式响应
        for chunk in stream:
            # chunk.choices[0].delta.content 会返回当前数据块的内容
            # 如果是流式开始，content 可能为 None
            if chunk.choices[0].delta.content is not None:
                content = chunk.choices[0].delta.content
                cleaned_content = extract_content(content)
                full_transcription += cleaned_content
                # 实时打印出当前收到的内容
                print(cleaned_content, end='', flush=True) 
        
        print("\n流式转录完成。")
        return full_transcription

    except Exception as e:
        print(f"流式转录音频片段时发生错误: {e}")
        return None

def process_audio(audio_path: str) -> str | None:
    """处理整个音频文件：分割、转录、合并。"""
    audio_chunks = split_audio(audio_path)
    
    if not audio_chunks:
        print("无法分割音频或音频为空。")
        return None
    
    transcriptions = []
    #prompt = "请记录下你所听到的语音内容并加上断句:"
    prompt = "请记录下你所听到的语音内容并加上断句，输出格式：仅纯文本，无引号，无额外说明。"
    
    for i, chunk in enumerate(audio_chunks):
        print(f"\n正在处理第 {i+1}/{len(audio_chunks)} 个音频片段...")
        
        # 调用流式转录函数
        transcription = transcribe_audio_chunk_stream(chunk, prompt)
        
        if transcription:
            transcriptions.append(transcription)
        else:
            print(f"  -> 转录失败！")
    
    full_transcription = "".join(transcriptions)
    return full_transcription

# --- 主程序入口 ---

if __name__ == "__main__":
    audio_path = "./spk_1762847420.wav"
    #audio_path = "./yangmi.wav"
    
    print("开始处理音频转录任务...")
    result = process_audio(audio_path)
    
    if result:
        print("\n" + "="*50)
        print("最终转录结果:")
        print("="*50)
        print(result)
    else:
        print("\n转录任务失败。")
        
    A_time = time.time() - S_time
    print(f"\n总耗时 {A_time:.2f} seconds")