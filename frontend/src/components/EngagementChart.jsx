import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, Tooltip as CJSTooltip, Legend, Filler,
} from 'chart.js';
import { Line as CJSLine } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  Title, CJSTooltip, Legend, Filler,
);

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '10px 14px', fontSize: 13,
    }}>
      <div style={{ color: 'var(--text-muted)', marginBottom: 4 }}>{label}</div>
      <div style={{ color: 'var(--accent-cyan)', fontWeight: 700 }}>
        {payload[0]?.value?.toFixed(1)} / 100
      </div>
    </div>
  );
};

export default function EngagementChart({ data = [] }) {
  if (!data || data.length === 0) {
    return (
      <div className="empty-state" style={{ padding: 40 }}>
        <div style={{ fontSize: 32 }}>📈</div>
        <p>No engagement data yet</p>
      </div>
    );
  }

  const labels  = data.map(d => d.time?.slice(11, 16) || d.time);
  const values  = data.map(d => d.avg_attention);

  const chartData = {
    labels,
    datasets: [{
      label: 'Avg Attention Score',
      data: values,
      borderColor: '#06b6d4',
      backgroundColor: 'rgba(6,182,212,0.08)',
      borderWidth: 2,
      pointRadius: 3,
      pointBackgroundColor: '#06b6d4',
      fill: true,
      tension: 0.4,
    }],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        backgroundColor: '#1a2235',
        borderColor: '#1e2d45',
        borderWidth: 1,
        titleColor: '#8899bb',
        bodyColor: '#f0f4ff',
      },
    },
    scales: {
      x: {
        grid:   { color: 'rgba(30,45,69,0.6)' },
        ticks:  { color: '#8899bb', font: { size: 11 } },
      },
      y: {
        min: 0, max: 100,
        grid:   { color: 'rgba(30,45,69,0.6)' },
        ticks:  { color: '#8899bb', font: { size: 11 } },
      },
    },
  };

  return (
    <div style={{ height: 220 }}>
      <CJSLine data={chartData} options={options} />
    </div>
  );
}
