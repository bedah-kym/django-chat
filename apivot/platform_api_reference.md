# Social Platform API Reference — Intelligence Collection Layer

**Classification:** Internal Technical Document  
**Version:** 1.0  
**Date:** June 2026  
**Scope:** All platform integrations required for passive intelligence collection across X, Meta, TikTok, YouTube, Telegram, Reddit, LinkedIn, Threads, and WhatsApp.

---

## Important Disclaimer

Unofficial SDKs and reverse-engineered APIs violate most platforms' Terms of Service. Their use carries legal risk, account suspension risk, and technical instability risk. This document covers them for completeness and research awareness. For any commercial or public-facing deployment, official APIs are the only defensible choice. Use unofficial options only for controlled research environments with throwaway accounts and after consulting legal counsel on your specific jurisdiction.

---

## Architecture Context

All platform collectors feed into the same pipeline:

```
Platform Bot → Redis Queue (BullMQ) → Django Consumer → LLM Tagger → PostgreSQL + AGE
```

Each platform integration is a standalone Node.js or Python service. They are swappable independently — a platform ban or API change affects only that collector, not the rest of the pipeline.

---

## 1. X (Twitter)

### Official API

**Base URL:** `https://api.twitter.com/2/`  
**Auth:** OAuth 2.0 Bearer Token (app-only) for read operations  
**Recommended Tier:** Basic ($100/month)

| Tier | Monthly Cost | Read Cap | Write Cap |
|---|---|---|---|
| Free | $0 | 1,500 tweets/month | 500 posts/month |
| Basic | $100 | 10,000 tweets/month | 3,000 posts/month |
| Pro | $5,000 | 1,000,000 tweets/month | 300,000 posts/month |

**Key Endpoints for Collection:**

```
GET /2/tweets/search/recent          — Search last 7 days (Basic+)
GET /2/tweets/search/all             — Full archive (Pro only)
GET /2/users/:id/tweets              — User timeline
GET /2/users/by/username/:username   — User lookup
GET /2/tweets/:id                    — Single tweet + metrics
GET /2/tweets/:id/retweeted_by       — Who retweeted
GET /2/tweets/:id/quote_tweets       — Quote tweets
GET /2/users/:id/followers           — Follower list
GET /2/users/:id/following           — Following list
GET /2/tweets/search/stream          — Filtered stream (Basic+)
```

**Fields to request on every tweet:**

```javascript
const params = {
  'tweet.fields': 'author_id,created_at,public_metrics,entities,context_annotations,geo',
  'user.fields': 'id,name,username,public_metrics,created_at,description,verified',
  'expansions': 'author_id,referenced_tweets.id,entities.mentions.username'
}
```

**Recommended SDK:** tweepy (Python)

```bash
pip install tweepy
```

```python
import tweepy

client = tweepy.Client(bearer_token=BEARER_TOKEN)

# Search recent tweets
response = client.search_recent_tweets(
    query="misinformation Kenya -is:retweet lang:en",
    tweet_fields=["author_id", "created_at", "public_metrics", "context_annotations"],
    expansions=["author_id"],
    user_fields=["username", "public_metrics", "created_at"],
    max_results=100
)
```

**Rate Limits (Basic tier):**

| Endpoint | Limit |
|---|---|
| Search recent | 60 requests/15 min |
| User timeline | 5 requests/15 min |
| User lookup | 300 requests/15 min |

**Streaming (recommended for real-time hashtag tracking):**

```python
class IntelStream(tweepy.StreamingClient):
    def on_tweet(self, tweet):
        # Forward to Redis queue
        queue.add('x_ingestion', tweet.data)

stream = IntelStream(bearer_token=BEARER_TOKEN)
stream.add_rules(tweepy.StreamRule("Kenya OR Nairobi lang:sw OR lang:en"))
stream.filter(tweet_fields=["author_id", "created_at", "public_metrics"])
```

### Unofficial Option

**twscrape** — scrapes the X web interface without an API key.

```bash
pip install twscrape
```

```python
from twscrape import API

api = API()
await api.pool.add_account("username", "password", "email", "email_password")
await api.pool.login_all()

async for tweet in api.search("Kenya propaganda", limit=100):
    print(tweet.id, tweet.rawContent)
```

**Risk level:** Medium-High. Uses actual user sessions. Account bans are common at scale. Use only with dedicated research accounts, never your main account.

---

## 2. Meta — Facebook

### Official API

**Base URL:** `https://graph.facebook.com/v21.0/`  
**Auth:** App Access Token or User Access Token  
**Required App Type:** Business App with Pages API access

**What is accessible via official API:**

- Public Page posts, comments, reactions, shares
- Page follower counts and engagement metrics
- CrowdTangle (deprecated — replaced by Content Library API)

**Meta Content Library API** is now the primary research access path for Facebook public content. Access requires applying as a qualified researcher through the Meta Research Platform.

```
Application URL: https://research.facebook.com/data/
Eligibility: Academic institutions, NGOs, research organisations
Approval timeline: 4–8 weeks
```

**Standard Graph API — Page Data:**

```python
import requests

def get_page_posts(page_id, access_token):
    url = f"https://graph.facebook.com/v21.0/{page_id}/posts"
    params = {
        "fields": "id,message,created_time,shares,reactions.summary(true),comments.summary(true)",
        "access_token": access_token,
        "limit": 100
    }
    return requests.get(url, params=params).json()
```

**Recommended SDK:** facebook-sdk (Python)

```bash
pip install facebook-sdk
```

**Important limitation:** The Graph API does not expose individual user profiles, personal timelines, or group content without user OAuth consent. Public Pages are the primary accessible surface.

### Unofficial Option

**facebook-scraper** (Python)

```bash
pip install facebook-scraper
```

```python
from facebook_scraper import get_posts

for post in get_posts("BBCNewsAfrica", pages=5):
    print(post['post_id'], post['text'], post['likes'], post['shares'])
```

Accesses public Pages and Groups without authentication. Meta actively blocks scraper user-agents — proxy rotation is required for sustained use.

**Risk level:** High. Meta's anti-automation detection is among the most aggressive of any platform.

---

## 3. Meta — Instagram

### Official API

**Base URL:** `https://graph.instagram.com/`  
**Auth:** OAuth 2.0 User Token  
**Access type:** Basic Display API (own account only) or Instagram Graph API (Business/Creator accounts)

The official Instagram API is heavily restricted for third-party collection. It exposes only content from accounts that have explicitly granted your app OAuth access. It is not suitable for passive intelligence collection on arbitrary public accounts.

**Recommended SDK:** instagrapi (unofficial — see below) for research use.

### Unofficial Option

**instagrapi** — wraps Instagram's private mobile API.

```bash
pip install instagrapi
```

```python
from instagrapi import Client

cl = Client()
cl.login("username", "password")

# Get user profile
user = cl.user_info_by_username("target_account")
print(user.follower_count, user.media_count, user.biography)

# Get recent posts
medias = cl.user_medias(user.pk, amount=20)
for media in medias:
    print(media.caption_text, media.like_count, media.comment_count)

# Get post comments
comments = cl.media_comments(media.pk, amount=50)
```

**Available data via instagrapi:**

- Public profile metadata (followers, following, bio, verified status)
- Post content, captions, hashtags, engagement metrics
- Comments and commenter profiles
- Story metadata (not content, usually)
- Follower and following lists (rate-limited)

**Risk level:** Medium-High. Instagram challenge flows (CAPTCHA, 2FA prompts) trigger frequently. Session persistence and proxy rotation are required. Use dedicated research accounts with aged history, never personal accounts.

**Production note:** For sustained research use, HikerAPI is a hosted provider that manages session and proxy complexity commercially.

---

## 4. TikTok

### Official Research API

**Base URL:** `https://open.tiktokapis.com/v2/research/`  
**Auth:** Client credentials flow  
**Access:** Application required — not open to individuals

Eligibility requires institutional affiliation (university, NGO, accredited research organisation). Individual developers do not qualify. The application process typically takes four weeks and requires a defined research proposal.

```
Application URL: https://developers.tiktok.com/products/research-api/
Geographic coverage: US, EU (limited expansion ongoing)
Daily quota: 1,000 requests/day, 100,000 records/day
Token expiry: 2 hours (must refresh)
```

**Available endpoints:**

```
POST /v2/research/video/query/       — Search videos by keyword, hashtag, date range
GET  /v2/research/user/info/         — Public user profile
GET  /v2/research/video/comment/list/ — Video comments
GET  /v2/research/user/followers/    — Follower list
GET  /v2/research/user/following/    — Following list
GET  /v2/research/hashtag/query/     — Hashtag data
```

**SDK: traktok (R) or direct HTTP in Python:**

```python
import requests

def get_tiktok_token(client_key, client_secret):
    response = requests.post(
        "https://open.tiktokapis.com/v2/oauth/token/",
        data={
            "client_key": client_key,
            "client_secret": client_secret,
            "grant_type": "client_credentials"
        }
    )
    return response.json()["access_token"]

def search_videos(token, keyword, start_date, end_date):
    headers = {"Authorization": f"Bearer {token}", "Content-Type": "application/json"}
    body = {
        "query": {
            "and": [{"operation": "IN", "field_name": "keyword", "field_values": [keyword]}]
        },
        "start_date": start_date,   # YYYYMMDD
        "end_date": end_date,
        "max_count": 100,
        "fields": "id,create_time,username,region_code,like_count,comment_count,share_count,view_count,hashtag_names"
    }
    return requests.post(
        "https://open.tiktokapis.com/v2/research/video/query/",
        headers=headers, json=body
    ).json()
```

### Unofficial Option

**TikTokApi** (Python) — uses Playwright to simulate browser sessions.

```bash
pip install TikTokApi
playwright install
```

```python
from TikTokApi import TikTokApi

async with TikTokApi() as api:
    await api.create_sessions(num_sessions=1, sleep_after=3)
    
    # Trending videos by hashtag
    async for video in api.hashtag(name="kenyapolitics").videos(count=30):
        print(video.id, video.stats)
    
    # User profile and videos
    user = api.user(username="target_account")
    async for video in user.videos(count=20):
        print(video.id, video.stats, video.create_time)
```

**Risk level:** Medium. TikTok's bot detection has improved significantly. Sessions need regular rotation. Not suitable for high-volume sustained collection.

---

## 5. YouTube

### Official API

**Base URL:** `https://www.googleapis.com/youtube/v3/`  
**Auth:** API Key (for public data) or OAuth 2.0 (for user data)  
**Cost:** Free tier — 10,000 units/day

YouTube has the most accessible and stable official API of any major platform for research purposes.

**Unit costs per operation:**

| Operation | Units |
|---|---|
| Search | 100 |
| Video details | 1 |
| Channel details | 1 |
| Comment threads | 1 |
| Captions | 50 |

**Recommended SDK:** google-api-python-client

```bash
pip install google-api-python-client
```

```python
from googleapiclient.discovery import build

youtube = build("youtube", "v3", developerKey=API_KEY)

# Search videos
search_response = youtube.search().list(
    q="Kenya misinformation",
    type="video",
    part="id,snippet",
    maxResults=50,
    order="date",
    publishedAfter="2026-01-01T00:00:00Z"
).execute()

# Get video statistics
video_ids = [item["id"]["videoId"] for item in search_response["items"]]
stats_response = youtube.videos().list(
    id=",".join(video_ids),
    part="snippet,statistics,contentDetails"
).execute()

# Get comments
comments = youtube.commentThreads().list(
    videoId=video_id,
    part="snippet",
    maxResults=100,
    order="relevance"
).execute()
```

**No unofficial SDK needed** — the official API is sufficiently open for research purposes.

---

## 6. Telegram

### Official Bot API

**Base URL:** `https://api.telegram.org/bot{token}/`  
**Auth:** Bot token from @BotFather  
**Cost:** Free, no rate limit tiers

The Bot API is limited to content in groups/channels where your bot is a member. It cannot passively observe public channels without joining them.

**Recommended SDK:** python-telegram-bot

```bash
pip install python-telegram-bot
```

```python
from telegram.ext import Application, MessageHandler, filters

async def collect_message(update, context):
    msg = update.message
    payload = {
        "platform": "telegram",
        "chat_id": msg.chat_id,
        "chat_title": msg.chat.title,
        "message_id": msg.message_id,
        "text": msg.text,
        "date": msg.date.isoformat(),
        "from_user": msg.from_user.username if msg.from_user else None,
        "forward_from_chat": msg.forward_from_chat.title if msg.forward_from_chat else None
    }
    # Forward to Redis queue
    queue.add('telegram_ingestion', payload)

app = Application.builder().token(BOT_TOKEN).build()
app.add_handler(MessageHandler(filters.TEXT, collect_message))
```

### MTProto API — Full Access

For passive monitoring of public channels without bot membership, use Pyrogram or Telethon. These use the full Telegram client protocol, not the Bot API.

**Recommended: Pyrogram**

```bash
pip install pyrogram tgcrypto
```

```python
from pyrogram import Client, filters

app = Client("intel_session", api_id=API_ID, api_hash=API_HASH)

@app.on_message(filters.channel)
async def monitor_channel(client, message):
    payload = {
        "channel": message.chat.title,
        "channel_id": message.chat.id,
        "message_id": message.id,
        "text": message.text,
        "date": message.date.isoformat(),
        "views": message.views,
        "forwards": message.forwards,
        "forward_from": message.forward_from_chat.title if message.forward_from_chat else None
    }
    # Forward to Redis queue

# Join and monitor a public channel
async def monitor_public_channel(channel_username):
    async with app:
        async for message in app.get_chat_history(channel_username, limit=200):
            print(message.text, message.views)
```

**API credentials:** Obtain from https://my.telegram.org/apps  
**Auth method:** Phone number verification on first run — generates a session file  
**Risk level:** Low for monitoring public channels. Telegram does not prohibit this programmatically.

---

## 7. Reddit

### Official API

**Base URL:** `https://oauth.reddit.com/`  
**Auth:** OAuth 2.0 (script app type for personal use)  
**Cost:** Free tier — 100 requests/minute

Reddit's API is relatively open and well-documented. The main limitation is that post history is capped at 1,000 items per subreddit/user via the standard API.

**Recommended SDK:** PRAW (Python Reddit API Wrapper)

```bash
pip install praw
```

```python
import praw

reddit = praw.Reddit(
    client_id=CLIENT_ID,
    client_secret=CLIENT_SECRET,
    user_agent="IntelBot/1.0 by YourUsername"
)

# Monitor subreddit for new posts
subreddit = reddit.subreddit("Kenya+nairobi+KenyaPolitics")

for post in subreddit.stream.submissions(skip_existing=True):
    payload = {
        "platform": "reddit",
        "post_id": post.id,
        "title": post.title,
        "body": post.selftext,
        "author": str(post.author),
        "subreddit": post.subreddit.display_name,
        "score": post.score,
        "upvote_ratio": post.upvote_ratio,
        "num_comments": post.num_comments,
        "created_utc": post.created_utc,
        "url": post.url
    }
    queue.add('reddit_ingestion', payload)

# Search across Reddit
for post in reddit.subreddit("all").search("Kenya misinformation", sort="new", limit=100):
    print(post.title, post.score)
```

**Pushshift alternative:** The Pushshift API historically provided full Reddit history beyond the 1,000-item cap. As of 2023 it requires researcher approval. Check current status at https://pushshift.io before relying on it.

---

## 8. LinkedIn

### Official API

LinkedIn has the most restrictive official API of any major platform. The Marketing Developer Platform and Partner Program are enterprise-gated. Standard developer access exposes only your own profile data.

For intelligence collection purposes, the official API is not viable without a formal partnership agreement with LinkedIn.

### Unofficial Option

**linkedin-api** (Python)

```bash
pip install linkedin-api
```

```python
from linkedin_api import Linkedin

api = Linkedin("email@example.com", "password")

# Search people
results = api.search_people(keywords="disinformation researcher Kenya", limit=20)

# Get profile
profile = api.get_profile("username-slug")
print(profile['firstName'], profile['headline'], profile['summary'])

# Get company posts
company = api.get_company("company-slug")
posts = api.get_company_updates("company-id", max_results=50)
```

**Risk level:** High. LinkedIn's bot detection is aggressive and account bans are permanent. Use only dedicated throwaway accounts with established history. Do not use personal or professional accounts under any circumstances.

**Commercial alternative:** Proxycurl — a paid API service that wraps LinkedIn data legally through their own access arrangements. Pricing starts at approximately $0.01 per profile lookup. Suitable if LinkedIn data is important to your use case and you want a defensible, ToS-compliant path.

---

## 9. Threads

### Official API

Meta launched the Threads API in late 2024. It is accessible to developers and does not require special research approval.

**Base URL:** `https://graph.threads.net/v1.0/`  
**Auth:** OAuth 2.0 User Token  
**Documentation:** https://developers.facebook.com/docs/threads

```python
import requests

def get_threads_user_posts(user_id, access_token):
    url = f"https://graph.threads.net/v1.0/{user_id}/threads"
    params = {
        "fields": "id,text,timestamp,media_type,like_count,replies_count",
        "access_token": access_token
    }
    return requests.get(url, params=params).json()

def search_threads(query, access_token):
    url = "https://graph.threads.net/v1.0/threads/search"
    params = {"q": query, "access_token": access_token}
    return requests.get(url, params=params).json()
```

**Limitation:** Like Instagram's official API, Threads access requires users to OAuth-authorise your app. Passive collection of arbitrary public accounts is not officially supported. Monitor the API changelog — Meta has been expanding access incrementally.

---

## 10. WhatsApp

### Unofficial Option — Baileys

You have already implemented Baileys for your WhatsApp ordering SaaS. The same library applies here for intelligence collection from WhatsApp groups and broadcast channels relevant to your research scope.

**Baileys (Node.js)**

```bash
npm install @whiskeysockets/baileys
```

```javascript
const { makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys')

async function startCollector() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info')
    
    const sock = makeWASocket({ auth: state })
    sock.ev.on('creds.update', saveCreds)
    
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const msg of messages) {
            if (!msg.message) continue
            
            const payload = {
                platform: 'whatsapp',
                jid: msg.key.remoteJid,
                message_id: msg.key.id,
                from: msg.key.participant || msg.key.remoteJid,
                text: msg.message?.conversation || 
                      msg.message?.extendedTextMessage?.text || null,
                timestamp: msg.messageTimestamp,
                is_group: msg.key.remoteJid.endsWith('@g.us'),
                forwarded: msg.message?.extendedTextMessage?.contextInfo?.isForwarded || false,
                forward_score: msg.message?.extendedTextMessage?.contextInfo?.forwardingScore || 0
            }
            
            // Forward score is particularly valuable — 
            // high forward counts indicate viral content
            queue.add('whatsapp_ingestion', payload)
        }
    })
}
```

**Key intelligence signal unique to WhatsApp:** The `forwardingScore` field indicates how many times a message has been forwarded before reaching your collection point. This is a direct virality signal unavailable on any other platform.

**Risk level:** Medium. WhatsApp bans accounts that exhibit automated behaviour patterns. Use dedicated SIM cards and accounts. Keep session activity human-paced.

---

## 11. Collection Payload Standard

All platform collectors normalise their output to a standard payload before queuing. This ensures the Django consumer and LLM tagger are platform-agnostic.

```python
# Standard payload schema — all platforms must conform to this
STANDARD_PAYLOAD = {
    # Required fields
    "platform": str,           # 'x', 'facebook', 'instagram', 'tiktok',
                               # 'youtube', 'telegram', 'reddit',
                               # 'linkedin', 'threads', 'whatsapp'
    "platform_post_id": str,   # Native platform identifier
    "platform_author_id": str, # Native author identifier
    "author_handle": str,      # Username/handle
    "content_text": str,       # Raw text content
    "collected_at": str,       # UTC ISO 8601 timestamp
    "posted_at": str,          # UTC ISO 8601 timestamp (platform native)
    
    # Engagement metrics — use null if unavailable, never 0
    "likes": int | None,
    "shares": int | None,
    "comments": int | None,
    "views": int | None,
    "reach": int | None,
    
    # Metadata
    "hashtags": list[str],     # Extracted hashtags
    "mentions": list[str],     # Mentioned accounts
    "urls": list[str],         # Linked URLs
    "media_type": str | None,  # 'text', 'image', 'video', 'audio'
    "language": str | None,    # ISO 639-1 language code
    "is_reply": bool,
    "is_repost": bool,
    "parent_post_id": str | None,  # If reply or repost
    
    # Provenance
    "collector_version": str,  # Bot version that collected this
    "collection_session_id": str,
    "raw_payload": dict        # Original platform response, unmodified
}
```

The `raw_payload` field is non-negotiable. Always store the original platform response verbatim. Schema assumptions will be wrong; raw data allows retroactive reprocessing.

---

## 12. Risk Matrix Summary

| Platform | Official API Quality | Unofficial Option | Ban Risk | Recommended Approach |
|---|---|---|---|---|
| X | Good (costly) | twscrape | Medium | Official Basic tier |
| Facebook | Limited | facebook-scraper | High | Official for Pages; unofficial for research only |
| Instagram | Very limited | instagrapi | High | Unofficial, dedicated accounts, proxies |
| TikTok | Good (gated) | TikTokApi | Medium | Apply for Research API; unofficial as interim |
| YouTube | Excellent | Not needed | Low | Official only |
| Telegram | Good (Bot API) | Pyrogram (MTProto) | Low | Pyrogram for channels, Bot API for groups |
| Reddit | Good | Not needed | Low | Official PRAW |
| LinkedIn | Not viable | linkedin-api | Very High | Proxycurl if needed commercially |
| Threads | Developing | Not needed yet | Low | Official, monitor for expansion |
| WhatsApp | Not applicable | Baileys | Medium | Baileys, human-paced sessions |

---

## 13. Dependency Reference

```txt
# Python — pip install all
tweepy>=4.14.0
praw>=7.7.0
google-api-python-client>=2.100.0
pyrogram>=2.0.0
tgcrypto>=1.2.5
instagrapi>=2.0.0
facebook-scraper>=0.2.59
linkedin-api>=2.0.0
python-telegram-bot>=21.0.0
requests>=2.31.0
redis>=5.0.0
```

```json
// Node.js — package.json dependencies
{
  "@whiskeysockets/baileys": "^6.7.0",
  "bullmq": "^5.0.0",
  "ioredis": "^5.3.0",
  "axios": "^1.6.0"
}
```

---

*This document reflects platform API states as of June 2026. Platform API terms, tiers, and access policies change frequently. Verify all endpoint availability and ToS compliance before implementation. All unofficial SDK usage is at the operator's own legal and operational risk.*
