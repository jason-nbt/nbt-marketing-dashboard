const SUPABASE_URL = "https://yvtujoueyotncbvdlgyf.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inl2dHVqb3VleW90bmNidmRsZ3lmIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4ODI0MDE5NCwiZXhwIjoyMTAzODE2MTk0fQ.TSZ3CKJfKX7VsI5AdbiDPmYXRO9DhnkS-zbeNozMdvw";
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let chartInstance = null;

async function loadDashboardMetrics(days = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days));

    const { data: transitions, error } = await supabaseClient
        .from('nmmsb_transitions')
        .select('*')
        .gte('transitioned_at', startDate.toISOString());

    if (error) {
        console.error("Error fetching metrics:", error);
        return;
    }

    processChartData(transitions);
}

function processChartData(transitions) {
    const statusCounts = {};

    transitions.forEach(t => {
        const status = t.to_status;
        statusCounts[status] = (statusCounts[status] || 0) + 1;
    });

    const labels = Object.keys(statusCounts);
    const counts = Object.values(statusCounts);

    document.getElementById('wonCount').innerText = statusCounts['CLOSED WON'] || 0;
    document.getElementById('lostCount').innerText = statusCounts['CLOSED LOST'] || 0;

    renderChart(labels, counts);
}

function renderChart(labels, dataPoints) {
    const ctx = document.getElementById('movementChart').getContext('2d');
    
    if (chartInstance) {
        chartInstance.destroy();
    }

    chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Status Transitions (Selected Period)',
                data: dataPoints,
                backgroundColor: '#0052CC'
            }]
        },
        options: {
            responsive: true,
            scales: {
                y: { beginAtZero: true }
            }
        }
    });
}

document.getElementById('periodSelect').addEventListener('change', (e) => {
    loadDashboardMetrics(e.target.value);
});

loadDashboardMetrics(30);