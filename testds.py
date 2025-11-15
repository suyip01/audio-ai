from openai import OpenAI

openai_api_key = "QErFh7EwE7ywHowY12866dCf-f9b5-42Cf-b71E-205f5eAa"  # API 密钥
openai_api_base = "https://api.modelverse.cn/v1"  # 接口地址

client = OpenAI(
    api_key=openai_api_key,
    base_url=openai_api_base,
)

response = client.chat.completions.create(
    model="deepseek-ai/DeepSeek-V3-0324",
    messages=[
        {"role": "system", "content": "使用100字进行总结回复"},
        {"role": "user", "content": "介绍UCloud"},
    ],
    stream=False,
    temperature=0.1,
    top_p=0.95
)
print(response.choices[0].message.content)