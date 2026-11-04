# ClassPulse
Teacher creates an AI-generated misconception check; students answer on their phones; the teacher sees a live pulse and a re-teach plan.

## Run
    cp .env.example .env   # add GEMINI_API_KEY
    npm install
    npm run dev            # client :5173, API :3001
    npm run build && npm start   # production, single port :3001

Needs Node 20.6+. Data lives in classpulse.db (SQLite).

## Design notes
- Correct answers and misconception labels never reach the student's browser; the server grades each answer and returns only the hint/explanation.
- The teacher's pulse is protected by a per-class token stored in the browser that created the class (no accounts yet).
- Lecture timestamps are AI-suggested placeholders; the teacher sets real ones after generating.
# classpulse
