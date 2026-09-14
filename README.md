# BoatSync Twin

BoatSync Twin is a frontend-only research prototype for offline-first edge command handling in connected marine systems. It uses deterministic synthetic vessel and network scenarios—no proprietary data, real hardware, MQTT broker, cloud service, authentication, backend, or database.

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite. A production build can be created with `npm run build`.

## 2-minute demo flow

1. Start on **Twin Dashboard** and note that AC is OFF across cloud, edge, and physical state. The vessel starts OFFLINE.
2. Select **Command Center**, then press **Send AC = ON**. The command becomes `CMD-1042` and enters the asynchronous queue.
3. Open **Conflict Lab**. Use **Stage offline conflict**, optionally toggle the physical AC, then choose **Reconnect**.
4. After the state exchange, observe the cloud request (`ON`) diverging from the edge/physical state (`OFF`).
5. Select one of the five resolution policies. With **Cloud Authority Wins**, press **Apply Cloud Authority Wins** and observe all three states converge to ON.
6. Open **Timeline** to trace the same sequence across Cloud, Network, Edge, and Physical Device lanes.
7. Open **Failure Simulator** and switch among Stable, Intermittent, High Latency, Packet Loss, Offline, and Reconnecting. Adjust latency, packet loss, and offline duration; the metrics update deterministically.

For the fastest guided version, press **Run 20-sec demo** at the top of any view.
