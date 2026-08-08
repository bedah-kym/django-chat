import os
import sys
import django
import asyncio

# Ensure DJANGO_SETTINGS_MODULE points to the project settings
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'Backend.settings')
# Make sure project root is on sys.path
sys.path.insert(0, '/app/Backend')

django.setup()

from orchestration.llm_client import LLMClient

async def main():
    client = LLMClient()
    print('Keys: deepseek=', bool(client.deepseek_key), 'anthropic=', bool(client.anthropic_key), 'hf=', bool(client.hf_key))
    system = "You are a test harness; respond briefly."
    user = "Hello DeepSeek — please say a one-line confirmation that DeepSeek worked."
    try:
        resp = await client.generate_text(system, user, temperature=0.0, max_tokens=200, provider_preference='deepseek')
        print('--- DeepSeek generate_text response start ---')
        print(resp)
        print('--- DeepSeek generate_text response end ---')
    except Exception as e:
        print('DeepSeek test failed:', e)

if __name__ == '__main__':
    asyncio.run(main())
