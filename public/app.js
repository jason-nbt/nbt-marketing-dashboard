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


async function loadStagnantProspects() {
    // 1. Fetch all prospects and all transitions
    const { data: prospects, error: pError } = await supabaseClient.from('nmmsb_prospects').select('*');
    const { data: transitions, error: tError } = await supabaseClient.from('nmmsb_transitions').select('*');

    if (pError || tError) {
        console.error("Error fetching data for table:", pError || tError);
        return;
    }

    // 2. Filter out closed tickets
    const activeProspects = prospects.filter(p => {
        const status = p.current_status.toUpperCase();
        return status !== 'CLOSED WON' && status !== 'CLOSED LOST';
    });

    const now = new Date();
    const stagnantList = [];

    // 3. Calculate days since last transition
    activeProspects.forEach(prospect => {
        // Find all transitions for this specific ticket
        const issueTransitions = transitions.filter(t => t.issue_key === prospect.issue_key);
        
        // Default to the creation date if it has never moved
        let lastActionDate = new Date(prospect.created_at); 

        if (issueTransitions.length > 0) {
            // Sort to find the most recent transition
            issueTransitions.sort((a, b) => new Date(b.transitioned_at) - new Date(a.transitioned_at));
            lastActionDate = new Date(issueTransitions[0].transitioned_at);
        }

        const diffTime = Math.abs(now - lastActionDate);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > 14) {
            stagnantList.push({
                ...prospect,
                daysStagnant: diffDays
            });
        }
    });

    // 4. Sort by worst offenders (most days stagnant)
    stagnantList.sort((a, b) => b.daysStagnant - a.daysStagnant);
    renderStagnantTable(stagnantList);
}

function renderStagnantTable(list) {
    const tbody = document.getElementById('stagnantBody');
    tbody.innerHTML = '';

    if (list.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding: 24px; color: #5e6c84;">No stagnant prospects! Your pipeline is moving well. 🎉</td></tr>';
        return;
    }

    list.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong><a href="https://nbt-marketing.atlassian.net/browse/${item.issue_key}" target="_blank" style="color: #0052CC; text-decoration: none;">${item.issue_key}</a></strong></td>
            <td>${item.summary}</td>
            <td>${item.assignee}</td>
            <td><span class="status-badge">${item.current_status}</span></td>
            <td class="warning-text">${item.daysStagnant} Days</td>
        `;
        tbody.appendChild(tr);
    });
}

// --- Modify your initial load call at the bottom of the file to include this ---
// Delete the old loadDashboardMetrics(30); and replace it with:
loadDashboardMetrics(30);
loadStagnantProspects();