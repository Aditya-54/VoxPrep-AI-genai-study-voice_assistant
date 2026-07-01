import os
import io
import base64
import logging
from datetime import datetime

# Set matplotlib backend to Agg to prevent GUI threading errors on Windows/CLI
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

import db

# Set up logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

REPORTS_DIR = "reports"
HTML_OUTPUT_PATH = os.path.join(REPORTS_DIR, "dashboard.html")


def generate_charts_base64() -> tuple[str, str]:
    """
    Generates performance charts using matplotlib.
    Returns them as Base64 encoded strings to embed directly in the HTML.
    """
    # 1. Fetch data from SQLite
    topic_stats = db.get_topic_stats()
    accuracy_history = db.get_accuracy_over_time()
    
    topic_chart_base64 = ""
    history_chart_base64 = ""
    
    # 2. Topic Accuracy Bar Chart
    if topic_stats:
        # Sort topics by accuracy ascending (so weakest are at the top or bottom)
        topic_stats_sorted = sorted(topic_stats, key=lambda x: x["accuracy"])
        topics = [s["topic"] for s in topic_stats_sorted]
        accuracies = [s["accuracy"] for s in topic_stats_sorted]
        
        # Shorten filenames for display
        display_topics = [t[:25] + "..." if len(t) > 25 else t for t in topics]
        
        # Color mapping: red for <50%, orange for 50-75%, green for >=75%
        colors = []
        for acc in accuracies:
            if acc < 50:
                colors.append("#ff5f5f")  # Coral red
            elif acc < 75:
                colors.append("#ffb84d")  # Soft orange
            else:
                colors.append("#4dff88")  # Mint green
                
        fig, ax = plt.subplots(figsize=(8, 4.5))
        bars = ax.barh(display_topics, accuracies, color=colors, height=0.6, edgecolor="none")
        
        # Style chart
        ax.set_xlim(0, 100)
        ax.set_xlabel("Accuracy (%)", fontsize=10, color="#ffffff")
        ax.set_title("Accuracy by Topic / File", fontsize=12, fontweight="bold", color="#ffffff", pad=15)
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color("#444444")
        ax.spines['bottom'].set_color("#444444")
        ax.tick_params(colors="#cccccc", labelsize=9)
        ax.grid(axis='x', linestyle='--', alpha=0.1)
        
        # Add labels to the ends of the bars
        for bar in bars:
            width = bar.get_width()
            ax.text(width + 2, bar.get_y() + bar.get_height()/2, f"{int(width)}%", 
                    va='center', ha='left', fontsize=9, color="#ffffff", fontweight="bold")
            
        fig.patch.set_facecolor('#1e1e24')
        ax.set_facecolor('#1e1e24')
        plt.tight_layout()
        
        # Save to Base64 buffer
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=120, facecolor=fig.get_facecolor(), edgecolor='none')
        buf.seek(0)
        topic_chart_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close(fig)

    # 3. Accuracy Over Time Line Chart
    if len(accuracy_history) >= 2:
        scores = [h["score"] * 100 for h in accuracy_history]  # Convert 0/0.5/1.0 to percentage
        
        # Compute a rolling average (e.g. window of 3 attempts) for smoother trend
        rolling_avg = []
        window = 3
        for i in range(len(scores)):
            start_idx = max(0, i - window + 1)
            subset = scores[start_idx:i+1]
            rolling_avg.append(sum(subset) / len(subset))
            
        fig, ax = plt.subplots(figsize=(8, 4.5))
        
        # Plot individual attempts as dots and rolling average as a line
        ax.plot(range(1, len(scores) + 1), rolling_avg, color="#4da6ff", linewidth=2.5, label="Rolling Avg (Window 3)")
        ax.scatter(range(1, len(scores) + 1), scores, color="#a3d2ca", alpha=0.5, s=30, label="Individual Score")
        
        # Style chart
        ax.set_ylim(-10, 110)
        ax.set_xlabel("Attempt Number", fontsize=10, color="#ffffff")
        ax.set_ylabel("Accuracy (%)", fontsize=10, color="#ffffff")
        ax.set_title("Performance Trend Over Time", fontsize=12, fontweight="bold", color="#ffffff", pad=15)
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color("#444444")
        ax.spines['bottom'].set_color("#444444")
        ax.tick_params(colors="#cccccc", labelsize=9)
        ax.grid(True, linestyle='--', alpha=0.1)
        ax.legend(facecolor='#1e1e24', edgecolor='#444444', labelcolor='#ffffff', loc='lower right')
        
        fig.patch.set_facecolor('#1e1e24')
        ax.set_facecolor('#1e1e24')
        plt.tight_layout()
        
        # Save to Base64 buffer
        buf = io.BytesIO()
        plt.savefig(buf, format='png', dpi=120, facecolor=fig.get_facecolor(), edgecolor='none')
        buf.seek(0)
        history_chart_base64 = base64.b64encode(buf.read()).decode('utf-8')
        plt.close(fig)
        
    return topic_chart_base64, history_chart_base64


def generate_dashboard() -> str:
    """Generates the HTML dashboard report and saves it to the reports folder."""
    os.makedirs(REPORTS_DIR, exist_ok=True)
    db.init_db()  # Ensure database exists
    
    attempts = db.get_all_attempts(limit=10)
    topic_stats = db.get_topic_stats()
    
    total_attempts = len(db.get_all_attempts(limit=10000))
    
    # Calculate global metrics
    avg_accuracy = 0.0
    weakest_topic = "N/A"
    strongest_topic = "N/A"
    
    if topic_stats:
        # Average of topic accuracies (weighted by attempts)
        total_score_pct = sum([s["accuracy"] * s["total_attempts"] for s in topic_stats])
        avg_accuracy = round(total_score_pct / total_attempts, 1) if total_attempts > 0 else 0.0
        
        # Find weakest and strongest
        sorted_stats = sorted(topic_stats, key=lambda x: x["accuracy"])
        weakest_topic = f"{sorted_stats[0]['topic']} ({int(sorted_stats[0]['accuracy'])}%)"
        strongest_topic = f"{sorted_stats[-1]['topic']} ({int(sorted_stats[-1]['accuracy'])}%)"
        
    # Shorten topic labels for dashboard display
    def clean_topic_label(t):
        return t[:35] + "..." if len(t) > 35 else t

    # Generate charts
    topic_chart_b64, history_chart_b64 = generate_charts_base64()
    
    # Compose HTML
    html_content = f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Voice Exam Prep Dashboard</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {{
            --bg-color: #0b0b0f;
            --card-bg: #15151c;
            --border-color: #262633;
            --text-primary: #ffffff;
            --text-secondary: #9ea0a8;
            --accent-primary: #4da6ff;
            --color-correct: #4dff88;
            --color-partial: #ffb84d;
            --color-incorrect: #ff5f5f;
        }}
        
        * {{
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }}
        
        body {{
            font-family: 'Outfit', sans-serif;
            background-color: var(--bg-color);
            color: var(--text-primary);
            padding: 2.5rem 1.5rem;
            line-height: 1.6;
        }}
        
        .container {{
            max-width: 1200px;
            margin: 0 auto;
        }}
        
        header {{
            margin-bottom: 2.5rem;
            border-bottom: 1px solid var(--border-color);
            padding-bottom: 1.5rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }}
        
        h1 {{
            font-size: 2.2rem;
            font-weight: 700;
            background: linear-gradient(135deg, #a5d3ff 0%, #4da6ff 100%);
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }}
        
        .last-updated {{
            font-size: 0.85rem;
            color: var(--text-secondary);
        }}
        
        /* Overview Cards Grid */
        .metrics-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2.5rem;
        }}
        
        .metric-card {{
            background-color: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 14px;
            padding: 1.5rem;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            transition: transform 0.2s, border-color 0.2s;
        }}
        
        .metric-card:hover {{
            transform: translateY(-2px);
            border-color: #3b3b4d;
        }}
        
        .metric-label {{
            font-size: 0.9rem;
            font-weight: 600;
            color: var(--text-secondary);
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 0.5rem;
        }}
        
        .metric-value {{
            font-size: 2rem;
            font-weight: 700;
            color: var(--text-primary);
        }}
        
        .metric-subtext {{
            font-size: 0.8rem;
            color: var(--text-secondary);
            margin-top: 0.2rem;
        }}
        
        /* Charts Section */
        .charts-grid {{
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(450px, 1fr));
            gap: 2rem;
            margin-bottom: 3rem;
        }}
        
        .chart-container {{
            background-color: #1e1e24;
            border: 1px solid var(--border-color);
            border-radius: 16px;
            padding: 1.5rem;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            min-height: 350px;
        }}
        
        .chart-placeholder {{
            text-align: center;
            color: var(--text-secondary);
            font-style: italic;
            padding: 3rem;
        }}
        
        .chart-img {{
            max-width: 100%;
            height: auto;
            border-radius: 8px;
        }}
        
        /* Table Section */
        .section-title {{
            font-size: 1.5rem;
            margin-bottom: 1.2rem;
            font-weight: 600;
            letter-spacing: -0.3px;
        }}
        
        .table-container {{
            background-color: var(--card-bg);
            border: 1px solid var(--border-color);
            border-radius: 16px;
            overflow-x: auto;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
            margin-bottom: 2rem;
        }}
        
        table {{
            width: 100%;
            border-collapse: collapse;
            text-align: left;
        }}
        
        th {{
            background-color: #1b1b24;
            color: var(--text-secondary);
            font-weight: 600;
            padding: 1rem 1.25rem;
            font-size: 0.85rem;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            border-bottom: 1px solid var(--border-color);
        }}
        
        td {{
            padding: 1.1rem 1.25rem;
            border-bottom: 1px solid var(--border-color);
            font-size: 0.9rem;
            vertical-align: top;
        }}
        
        tr:last-child td {{
            border-bottom: none;
        }}
        
        tr:hover td {{
            background-color: #1b1b24;
        }}
        
        .badge {{
            display: inline-block;
            padding: 0.25rem 0.6rem;
            border-radius: 6px;
            font-size: 0.75rem;
            font-weight: 700;
            text-transform: uppercase;
        }}
        
        .badge-correct {{
            background-color: rgba(77, 255, 136, 0.15);
            color: var(--color-correct);
            border: 1px solid rgba(77, 255, 136, 0.25);
        }}
        
        .badge-partial {{
            background-color: rgba(255, 184, 77, 0.15);
            color: var(--color-partial);
            border: 1px solid rgba(255, 184, 77, 0.25);
        }}
        
        .badge-incorrect {{
            background-color: rgba(255, 95, 95, 0.15);
            color: var(--color-incorrect);
            border: 1px solid rgba(255, 95, 95, 0.25);
        }}
        
        .meta-text {{
            font-size: 0.75rem;
            color: var(--text-secondary);
            margin-top: 0.25rem;
        }}
        
        .no-data {{
            padding: 3rem;
            text-align: center;
            color: var(--text-secondary);
            font-style: italic;
        }}
    </style>
</head>
<body>
    <div class="container">
        <header>
            <div>
                <h1>Voice Exam Prep Assistant</h1>
                <p style="color: var(--text-secondary); font-size: 0.95rem; margin-top: 0.2rem;">Personalized Study Performance Dashboard</p>
            </div>
            <div class="last-updated">
                Last updated: {datetime.now().strftime("%Y-%m-%d %H:%M")}
            </div>
        </header>
        
        <!-- Overview Stats -->
        <section class="metrics-grid">
            <div class="metric-card">
                <div class="metric-label">Total Attempts</div>
                <div class="metric-value">{total_attempts}</div>
                <div class="metric-subtext">Cumulative quiz trials</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Avg Accuracy</div>
                <div class="metric-value">{avg_accuracy}%</div>
                <div class="metric-subtext">Weighted score avg</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Needs Focus</div>
                <div class="metric-value" style="font-size: 1.25rem; margin-top: 0.5rem; word-break: break-all; color: var(--color-incorrect);">{clean_topic_label(weakest_topic)}</div>
                <div class="metric-subtext">Lowest scoring topic</div>
            </div>
            <div class="metric-card">
                <div class="metric-label">Mastered Topic</div>
                <div class="metric-value" style="font-size: 1.25rem; margin-top: 0.5rem; word-break: break-all; color: var(--color-correct);">{clean_topic_label(strongest_topic)}</div>
                <div class="metric-subtext">Highest scoring topic</div>
            </div>
        </section>
        
        <!-- Charts Area -->
        <section class="charts-grid">
            <!-- Chart 1: Topic Performance -->
            <div class="chart-container">
                {f'<img class="chart-img" src="data:image/png;base64,{topic_chart_b64}" alt="Topic Performance Chart">' if topic_chart_b64 else '<div class="chart-placeholder">Not enough performance data to plot topic accuracy. Complete a few quizzes first!</div>'}
            </div>
            
            <!-- Chart 2: History Trend -->
            <div class="chart-container">
                {f'<img class="chart-img" src="data:image/png;base64,{history_chart_b64}" alt="Accuracy Over Time Chart">' if history_chart_b64 else '<div class="chart-placeholder">Not enough history to display trend line. Need at least 2 attempts!</div>'}
            </div>
        </section>
        
        <!-- Attempts Log Table -->
        <section>
            <h2 class="section-title">Recent Quiz Attempts</h2>
            <div class="table-container">
                {f"""<table>
                    <thead>
                        <tr>
                            <th style="width: 15%">Date/Time</th>
                            <th style="width: 20%">Topic</th>
                            <th style="width: 25%">Question</th>
                            <th style="width: 15%">Verdict</th>
                            <th style="width: 25%">Feedback Excerpt</th>
                        </tr>
                    </thead>
                    <tbody>""" if attempts else '<div class="no-data">No recorded attempts in database yet. Start studying to log results!</div>'}
                    
                    {"".join([f'''
                        <tr>
                            <td>
                                {datetime.strptime(att["timestamp"], "%Y-%m-%d %H:%M:%S").strftime("%b %d, %I:%M %p") if " " in att["timestamp"] else att["timestamp"]}
                            </td>
                            <td>
                                <strong>{clean_topic_label(att["topic"])}</strong>
                                <div class="meta-text">Pg. {att["page_number"]}</div>
                            </td>
                            <td style="font-size: 0.85rem; color: var(--text-secondary);">{att["question"]}</td>
                            <td>
                                <span class="badge badge-{att["verdict"].lower().replace(' ', '')}">{att["verdict"]}</span>
                            </td>
                            <td style="font-size: 0.85rem; color: var(--text-secondary); font-style: italic;">
                                {att["explanation"][:120] + "..." if len(att["explanation"]) > 120 else att["explanation"]}
                            </td>
                        </tr>
                    ''' for att in attempts]) if attempts else ""}
                    
                {"" if not attempts else "</tbody></table>"}
            </div>
        </section>
    </div>
</body>
</html>
"""
    
    with open(HTML_OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write(html_content)
        
    logger.info(f"Dashboard HTML file successfully written to '{HTML_OUTPUT_PATH}'")
    return HTML_OUTPUT_PATH


if __name__ == "__main__":
    path = generate_dashboard()
    print(f"Generated dashboard HTML: {os.path.abspath(path)}")
