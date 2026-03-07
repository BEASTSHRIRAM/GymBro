import socket
import asyncio
import aiohttp
import httpx
import sys

async def test_dns():
    host = "sfu-aws-mumbai-vp1-fd81fdf2eedd.stream-io-video.com"
    print(f"Testing resolution for: {host}")
    
    # 1. Standard Socket Peer
    print("\n1. Testing socket.getaddrinfo...")
    try:
        addr = socket.getaddrinfo(host, 443)
        print(f"Socket Success: {addr[0][4][0]}")
    except Exception as e:
        print(f"Socket Failed: {e}")

    # 2. httpx (Alternative to aiohttp)
    print("\n2. Testing httpx...")
    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(f"https://{host}", timeout=5)
            print(f"httpx Success: {resp.status_code}")
    except Exception as e:
        print(f"httpx Failed: {type(e).__name__}: {e}")

if __name__ == "__main__":
    asyncio.run(test_dns())
