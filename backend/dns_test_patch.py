import socket
import asyncio
import aiohttp
import sys

# --- THE MONKEY PATCH ---
class SystemResolver(aiohttp.abc.AbstractResolver):
    async def resolve(self, host: str, port: int = 0, family: int = 0) -> list:
        # Force use of system socket resolver (which works for nslookup/httpx)
        infos = await asyncio.get_event_loop().run_in_executor(
            None, socket.getaddrinfo, host, port, family, socket.SOCK_STREAM
        )
        results = []
        for family, type, proto, canonname, sockaddr in infos:
            results.append({
                'hostname': host,
                'host': sockaddr[0],
                'port': sockaddr[1],
                'family': family,
                'proto': proto,
                'flags': socket.AI_NUMERICHOST,
            })
        return results
    async def close(self) -> None:
        pass

_original_init = aiohttp.TCPConnector.__init__
def _patched_init(self, *args, **kwargs):
    if 'resolver' not in kwargs:
        kwargs['resolver'] = SystemResolver()
    _original_init(self, *args, **kwargs)

aiohttp.TCPConnector.__init__ = _patched_init
# -------------------------

async def test_dns():
    host = "sfu-aws-mumbai-vp1-fd81fdf2eedd.stream-io-video.com"
    print(f"Testing resolution for: {host} (WITH PATCH)")
    
    try:
        # This used to fail, now it should use the SystemResolver
        async with aiohttp.ClientSession() as session:
            async with session.get(f"https://{host}", timeout=5) as resp:
                print(f"aiohttp (Patched) Success: {resp.status}")
    except Exception as e:
        print(f"aiohttp (Patched) Failed: {type(e).__name__}: {e}")

if __name__ == "__main__":
    asyncio.run(test_dns())
