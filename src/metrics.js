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
    const attributes = [
        { key: "source", value: { stringValue: "jwt-pizza-service" } },
        ...Object.entries(extraAttributes).map(([k, v]) => ({
            key: k,
            value: { stringValue: v.toString() },
        })),
    ];

    const metric = {
        name,
        unit,
        [type]: {
            dataPoints: [
                {
                    asInt: value,
                    timeUnixNano: Date.now() * 1000000,
                    attributes,
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
    return Math.round(cpuUsage * 100);
}

function getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    return Math.round((usedMemory / totalMemory) * 100);
}

const requests = {};

// Middleware to track requests
function requestTracker(req, res, next) {
    const endpoint = `[${req.method}] ${req.path}`;
    requests[endpoint] = (requests[endpoint] || 0) + 1;
    next();
}

// --- Main periodic function ---
function sendMetricsPeriodically(period) {
    setInterval(() => {
        try {
            const metrics = new OtelMetricBuilder();

            // Build system metrics
            Object.keys(requests).forEach((endpoint) => {
                metrics.add(
                    createMetric("requests", requests[endpoint], "sum", "1", {
                        endpoint,
                    })
                );
            });
            metrics.add(
                createMetric("cpu", getCpuUsagePercentage(), "gauge", "%")
            );
            metrics.add(
                createMetric("memory", getMemoryUsagePercentage(), "gauge", "%")
            );

            metrics.sendToGrafana();
        } catch (error) {
            console.log("Error sending metrics", error);
        }
    }, period);
}

module.exports = {
    requestTracker,
    sendMetricsPeriodically,
};
