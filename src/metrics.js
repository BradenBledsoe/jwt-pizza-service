const config = require("./config");
const os = require("os");

// --- Metric Builder Mock ---
class OtelMetricBuilder {
    constructor() {
        this.metrics = [];
    }

    add(metric) {
        if (metric) this.metrics.push(metric);
    }

    sendToGrafana() {
        const body = JSON.stringify({
            resourceMetrics: [
                {
                    scopeMetrics: [
                        {
                            metrics: this.metrics,
                        },
                    ],
                },
            ],
        });

        fetch(`${config.metrics.url}`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${config.metrics.apiKey}`,
                "Content-Type": "application/json",
            },
            body,
        })
            .then((res) => {
                if (!res.ok) {
                    res.text().then((text) =>
                        console.error(
                            `Failed to send metrics: ${text}\n${body}`
                        )
                    );
                } else {
                    console.log(
                        `Successfully pushed ${this.metrics.length} metrics`
                    );
                }
            })
            .catch((err) => console.error("Error sending metrics:", err));
    }
}

// --- Metric Helpers ---
function createMetric(name, value, type, unit) {
    const metric = {
        name,
        unit,
        [type]: {
            dataPoints: [
                {
                    asDouble: value,
                    timeUnixNano: Date.now() * 1000000,
                },
            ],
        },
    };

    if (type === "sum") {
        metric[type].aggregationTemporality =
            "AGGREGATION_TEMPORALITY_CUMULATIVE";
        metric[type].isMonotonic = true;
    }

    return metric;
}

function getCpuUsagePercentage() {
    const cpuUsage = os.loadavg()[0] / os.cpus().length;
    return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = (usedMemory / totalMemory) * 100;
    return memoryUsage.toFixed(2);
}

// --- Main periodic function ---
let requests = 0;
let latency = 0;

function sendMetricsPeriodically(period) {
    setInterval(() => {
        try {
            const metrics = new OtelMetricBuilder();

            // Build system metrics
            const cpu = createMetric(
                "cpu",
                getCpuUsagePercentage(),
                "gauge",
                "%"
            );
            const memory = createMetric(
                "memory",
                getMemoryUsagePercentage(),
                "gauge",
                "%"
            );
            metrics.add(cpu);
            metrics.add(memory);

            // Simulate other metrics
            requests += Math.floor(Math.random() * 200) + 1;
            latency += Math.floor(Math.random() * 200) + 1;

            const http = createMetric("requests", requests, "sum", "1");
            const latencyMetric = createMetric("latency", latency, "sum", "ms");
            metrics.add(http);
            metrics.add(latencyMetric);

            // You can define and add userMetrics, purchaseMetrics, authMetrics here too
            // metrics.add(userMetrics);
            // metrics.add(purchaseMetrics);
            // metrics.add(authMetrics);

            metrics.sendToGrafana();
        } catch (error) {
            console.log("Error sending metrics", error);
        }
    }, period);
}

module.exports = {
    sendMetricsPeriodically,
};
