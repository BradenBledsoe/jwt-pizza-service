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
function createMetric(name, value, type, unit, extraAttributes = {}) {
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

// Track HTTP requests
const httpRequestCounts = {
    total: 0,
    GET: 0,
    POST: 0,
    PUT: 0,
    DELETE: 0,
};

const activeUsers = new Map();

function requestTracker(req, res, next) {
    const method = req.method.toUpperCase();
    httpRequestCounts.total++;
    if (httpRequestCounts[method] !== undefined) {
        httpRequestCounts[method]++;
    }

    next();
}

function countActiveUsers(windowMs = 5 * 60 * 1000) {
    const now = Date.now();
    let activeCount = 0;

    for (const lastSeen of activeUsers.entries()) {
        if (now - lastSeen <= windowMs) {
            activeCount++;
        }
    }

    return activeCount;
}

// Called when a user logs in or registers
function trackUserLogin(token) {
    if (token) activeUsers.set(token, Date.now());
}

// Called when a user logs out
function trackUserLogout(token) {
    activeUsers.delete(token);
}

// --- Authentication tracking ---
const authMetrics = {
    success: 0,
    failure: 0,
};

function trackAuthSuccess() {
    authMetrics.success++;
}

function trackAuthFailure() {
    authMetrics.failure++;
}

// --- Latency tracking ---
const latencyMetrics = {
    totalLatency: 0,
    requestCount: 0,
};

function latencyTracker(req, res, next) {
    const start = Date.now();
    res.on("finish", () => {
        const duration = Date.now() - start;
        latencyMetrics.totalLatency += duration;
        latencyMetrics.requestCount++;
    });
    next();
}

// --- Pizza metrics ---
const pizzaMetrics = {
    sold: 0, // total pizzas sold
    creationFailures: 0, // failed creation attempts
    revenue: 0, // total revenue in USD
    totalLatency: 0, // total latency accumulated in ms
    requestCount: 0, // number of pizza creation requests
};

function trackPizzaSold(count = 1) {
    pizzaMetrics.sold += count;
}

function trackPizzaFailure() {
    pizzaMetrics.creationFailures++;
}

function trackPizzaRevenue(amount) {
    pizzaMetrics.revenue += amount;
}

function trackPizzaLatency(durationMs) {
    pizzaMetrics.totalLatency += durationMs;
    pizzaMetrics.requestCount++;
}

// --- Main periodic function ---
function sendMetricsPeriodically(period) {
    setInterval(() => {
        try {
            const metrics = new OtelMetricBuilder();

            // Build system metrics
            metrics.add(
                createMetric(
                    "http_requests",
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
                    "http_requests_post",
                    httpRequestCounts.POST,
                    "sum",
                    "1"
                )
            );
            metrics.add(
                createMetric(
                    "http_requests_put",
                    httpRequestCounts.PUT,
                    "sum",
                    "1"
                )
            );
            metrics.add(
                createMetric(
                    "http_requests_delete",
                    httpRequestCounts.DELETE,
                    "sum",
                    "1"
                )
            );

            metrics.add(
                createMetric(
                    "active_users",
                    countActiveUsers(),
                    "gauge",
                    "users"
                )
            );

            metrics.add(
                createMetric("auth_success", authMetrics.success, "sum", "1")
            );
            metrics.add(
                createMetric("auth_failure", authMetrics.failure, "sum", "1")
            );

            metrics.add(
                createMetric("cpu", getCpuUsagePercentage(), "gauge", "%")
            );
            metrics.add(
                createMetric("memory", getMemoryUsagePercentage(), "gauge", "%")
            );

            // --- Pizza metrics ---
            metrics.add(
                createMetric("pizzas_sold", pizzaMetrics.sold, "sum", "1")
            );
            metrics.add(
                createMetric(
                    "pizza_creation_failures",
                    pizzaMetrics.creationFailures,
                    "sum",
                    "1"
                )
            );
            metrics.add(
                createMetric(
                    "pizza_revenue",
                    Math.round(pizzaMetrics.revenue * 100),
                    "sum",
                    "cents"
                )
            );

            // Calculate average latency
            let avgLatency = 0;
            if (latencyMetrics.requestCount > 0) {
                avgLatency =
                    latencyMetrics.totalLatency / latencyMetrics.requestCount;
                latencyMetrics.totalLatency = 0;
                latencyMetrics.requestCount = 0;
            }

            metrics.add(
                createMetric("service_latency", avgLatency, "gauge", "ms")
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
    trackUserLogin,
    trackUserLogout,
    trackAuthSuccess,
    trackAuthFailure,
    latencyTracker,
    trackPizzaFailure,
    trackPizzaSold,
    trackPizzaRevenue,
    trackPizzaLatency,
};
