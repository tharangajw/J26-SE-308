class PodStartupFilter:
    """
    Implements the Cao & Long 90-second pod-startup exclusion window.
    During pod initialization (0 - 90 seconds), initial CPU/memory spikes are normal
    workload initialization artifacts and should be pre-filtered to avoid false anomaly triggers.
    """
    def __init__(self, startup_window_sec: float = 90.0):
        self.startup_window_sec = startup_window_sec

    def is_in_startup_window(self, pod_uptime_sec: float) -> bool:
        return pod_uptime_sec < self.startup_window_sec

    def filter_telemetry_snapshot(self, snapshot: dict) -> dict:
        uptime = snapshot.get("pod_uptime_sec", 100.0)
        filtered = snapshot.copy()
        if self.is_in_startup_window(uptime):
            filtered["excluded_by_prefilter"] = True
            filtered["prefilter_reason"] = f"Pod in startup window ({uptime}s < {self.startup_window_sec}s)"
        else:
            filtered["excluded_by_prefilter"] = False
            filtered["prefilter_reason"] = None
        return filtered
