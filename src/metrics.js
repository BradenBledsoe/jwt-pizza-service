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
                    asDoubles: value,
                    timeUnixNano: Date.now() * 1000000,
                    attributes: [
                        {
                            key: "source",
                            value: { stringValue: "jwt-pizza-service" },
                        },
                    ],
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
    return Number((cpuUsage * 100).toFixed(2));
}

function getMemoryUsagePercentage() {
    const totalMemory = os.totalmem();
    const freeMemory = os.freemem();
    const usedMemory = totalMemory - freeMemory;
    return Number(((usedMemory / totalMemory) * 100).toFixed(2));
}

// Track HTTP requests
const httpRequestCounts = {
    total: 0,
    GET: 0,
    POST: 0,
    PUT: 0,
    DELETE: 0,
};

function requestTracker(req, res, next) {
    const method = req.method.toUpperCase();
    httpRequestCounts.total++;
    if (httpRequestCounts[method] !== undefined) {
        httpRequestCounts[method]++;
    }

    next();
}

// --- Main periodic function ---
let requests = 0;
let latency = 0;

function sendMetricsPeriodically(period) {
    setInterval(() => {
        try {
            const metrics = new OtelMetricBuilder();

            // Build system metrics
            metrics.add(
                createMetric(
                    "http_requests_total",
                    httpRequestCounts.total,
                    "sum",
                    "1"
                )
            );
            metrics.add(
                createMetric(
                    "http_requests_get",
                    httpRequestCounts.GET,
                    "sum",
                    "1"
                )
            );
            metrics.add(
                createMetric(
                    "http_requests_get",
                    httpRequestCounts.POST,
                    "sum",
                    "1"
                )
            );
            metrics.add(
                createMetric(
                    "http_requests_get",
                    httpRequestCounts.PUT,
                    "sum",
                    "1"
                )
            );
            metrics.add(
                createMetric(
                    "http_requests_get",
                    httpRequestCounts.DELETE,
                    "sum",
                    "1"
                )
            );

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
