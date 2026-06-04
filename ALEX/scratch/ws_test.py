import asyncio
import websockets
import json

async def test_ws():
    uri = "ws://127.0.0.1:8000/ws"
    try:
        async with websockets.connect(uri) as websocket:
            print("Connected to WebSocket server.")
            # Send init message
            init_msg = {
                "type": "init",
                "mode": "offline",
                "modelName": "deepseek-r1:8b"
            }
            await websocket.send(json.dumps(init_msg))
            print("Sent init message.")
            
            # Wait for responses
            for _ in range(5):
                response = await websocket.recv()
                print(f"Received: {response}")
    except Exception as e:
        print(f"Error: {e}")

asyncio.run(test_ws())
