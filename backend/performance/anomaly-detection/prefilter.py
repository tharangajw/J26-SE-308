# Implements the Cao & Long 90-second Kubernetes pod-startup exclusion window
# to filter out cold-start CPU and memory initialization spikes from triggering false alarms.
class PodStartupFilter:
    # Initializes the configurable startup exclusion threshold, defaulting to 90 seconds.
    def __init__(self, startup_window_sec: float = 90.0):
        self.startup_window_sec = startup_window_sec

    # Checks whether a given pod uptime falls within the cold-start initialization window.
    def is_in_startup_window(self, pod_uptime_sec: float) -> bool:
        return pod_uptime_sec < self.startup_window_sec

    # Evaluates a telemetry snapshot and tags whether it should be excluded from anomaly scoring.
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
