# TrackItOut — Your Personal Life Copilot

**Track everything. Understand yourself. Improve every day.**

TrackItOut is an intelligent, full-stack personal life management platform designed to bring your finances, nutrition, fitness, habits, and everyday progress together in one place.

Instead of switching between multiple applications to manage different aspects of life, TrackItOut provides a unified environment where users can record activities, monitor progress, understand patterns, and make better everyday decisions.

Built with React, Node.js, Express, MySQL, and an extensible AI-powered architecture, TrackItOut aims to become a personal operating system for everyday life.

---

## 🚀 Overview

Modern life involves managing multiple interconnected areas:

- Financial stability
- Nutrition and dietary habits
- Fitness and physical activity
- Personal habits and routines
- Long-term goals and progress

TrackItOut brings these areas together through a centralized dashboard and a unified personal assistant experience.

The platform combines structured tracking, analytics, personalized records, and intelligent assistance to help users understand their daily activities and make informed improvements.

**One platform. Multiple dimensions of life. One personal copilot.**

---

## ✨ Core Features

### 💰 1. Personal Finance Management

Manage your financial life with a centralized finance management system.

**Features:**
- Income and expense tracking
- Multiple financial accounts
- Account-to-account transfers
- Transaction categorization
- Transaction history
- Monthly budgets
- Budget utilization tracking
- Savings goals and contributions
- Recurring transactions
- Financial summaries and analytics
- Account balance monitoring

Track where your money comes from, where it goes, and how your financial habits evolve over time.

### 🥗 2. Nutrition Intelligence

Monitor your food intake and understand your daily nutritional patterns.

**Features:**
- Food product catalog
- Branded food information
- Meal logging
- Food quantity and serving tracking
- Daily calorie tracking
- Protein, carbohydrate, and fat tracking
- Fibre and other available nutrient tracking
- Personalized nutrition targets
- Meal history
- Food verification status
- Nutrition progress monitoring

Track your daily nutrition with structured food records and nutrient information.

### 🏋️ 3. Fitness & Workout Management

Manage workouts, training routines, exercise history, and fitness progression.

**Features:**
- Personalized workout routines
- Exercise catalog
- Workout sessions
- Set, repetition, and weight tracking
- Workout history
- Personal records
- Body measurements
- Fitness progression
- Workout rotation management
- Daily activity tracking
- Energy expenditure estimation

**Personalized Workout Split**

The platform supports a continuous four-routine training structure:

- Routine A — Chest, Shoulders & Abs
- Routine B — Back & Abs
- Routine C — Biceps, Triceps & Forearms
- Routine D — Legs

The workout rotation is designed to progress continuously rather than automatically resetting every Monday.

### 🔥 4. Scientific Energy Tracking

Track energy expenditure using structured activity and nutrition information.

**Features:**
- Estimated resting energy expenditure
- Workout energy expenditure
- Walking activity expenditure
- Non-exercise activity tracking
- Thermic effect of food estimation
- Estimated total daily energy expenditure
- Energy trend monitoring
- TDEE calibration using historical data

The energy engine uses established estimation equations and activity-based calculations.

Estimates are distinguished from measured values and depend on the availability and completeness of user records.

### 🎯 5. Habits & Lifestyle Management

Build consistency through structured daily habit tracking.

**Features:**
- Daily habit management
- Habit completion tracking
- Progress monitoring
- Streak tracking
- Personal routines
- Lifestyle activity records
- Goal-oriented tracking

Create routines, monitor consistency, and understand your progress over time.

### 📊 6. Unified Analytics Dashboard

Bring different areas of personal activity into a centralized analytics experience.

**Financial analytics**
- Income and expense trends
- Spending patterns
- Budget utilization
- Savings progress

**Nutrition analytics**
- Calorie trends
- Macronutrient progress
- Daily nutrition summaries
- Historical food records

**Fitness analytics**
- Workout history
- Training progression
- Personal records
- Activity trends

**Lifestyle analytics**
- Habit completion
- Streaks
- Consistency tracking
- Historical progress

The goal is to turn everyday records into meaningful insights.

### 🤖 7. AI Personal Copilot

TrackItOut is designed around a unified personal assistant that connects different areas of the platform.

The Copilot experience provides a central interface for interacting with personal tracking features.

**Intended interaction examples:**

- "I spent ₹150 on lunch."
- "I ate three eggs."
- "Log 200 grams of paneer."
- "I completed my chest workout."
- "My current weight is 72.5 kg."
- "I drank 500 ml of water."

The long-term vision is to support natural-language and voice-based interactions that translate everyday activities into structured personal records.

**Planned intelligent capabilities:**
- Natural-language activity extraction
- Context-aware assistance
- Structured action execution
- Personalized recommendations
- Financial pattern analysis
- Nutrition assistance
- Fitness progress insights
- Intelligent daily summaries
- Voice-first interactions

AI-generated information and estimates should be distinguished from verified records and actual user data.

---

## 🧠 Technology Stack

TrackItOut uses a modular full-stack architecture.

### Frontend

- React.js
- JavaScript (ES6+)
- HTML5
- CSS3
- Tailwind CSS
- Axios
- Lucide React
- Charting libraries

### Backend

- Node.js
- Express.js
- RESTful APIs
- JWT Authentication
- Modular controllers and services
- Server-side validation

### Database

- MySQL
- Relational database architecture
- User-specific data isolation
- Database migrations
- Structured financial, nutrition, and fitness records

### Development & Tools

- Git
- GitHub
- Visual Studio Code
- MySQL Workbench
- npm
- Browser-based testing

### Future AI Infrastructure

The architecture is intended to support additional intelligent services, including:

- Python
- FastAPI
- Large Language Models (LLMs)
- Retrieval-Augmented Generation (RAG)
- Tool calling and agentic workflows
- Machine Learning
- Natural Language Processing
- Data analytics

These represent the planned extensible AI direction and should not be interpreted as confirmation that every service is already deployed.

---

## 🏗 System Architecture

TrackItOut follows a modular client-server architecture.

```text
                 USER
                   |
                   ▼
          REACT FRONTEND
                   |
          Application Shell
                   |
      ┌────────────┼────────────┐
      |            |            |
      ▼            ▼            ▼
   FINANCE      NUTRITION     FITNESS
      |            |            |
      └────────────┼────────────┘
                   |
                   ▼
             REST API
          NODE.JS / EXPRESS
                   |
          Authentication
          Controllers
          Services
          Validation
                   |
                   ▼
              MYSQL DB
                   |
                   ▼
          STRUCTURED USER DATA

          FUTURE AI EXTENSION
                   |
                   ▼
           AI PERSONAL COPILOT
                   |
       LLM / RAG / TOOL CALLING
                   |
                   ▼
        AUTHORIZED APPLICATION APIs
```

The architecture separates frontend presentation, backend business logic, authentication, and persistent data storage.

---

## 📂 Project Structure

```text
TrackItOut/
│
├── frontend/
│   ├── public/
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── services/
│   │   └── ...
│   └── package.json
│
├── backend/
│   ├── controllers/
│   ├── routes/
│   ├── middleware/
│   ├── database/
│   ├── services/
│   └── ...
│
├── .gitignore
├── README.md
└── LICENSE
```

*The directory structure may evolve as additional modules and services are introduced.*

---

## 🔐 Authentication & Data Security

TrackItOut uses authentication and user-specific data handling.

Security considerations include:

- JWT-based authentication
- Protected application routes
- User-specific data access
- Server-side input validation
- Ownership checks for user resources
- Environment-based configuration
- Separation of sensitive credentials from source code

Never commit `.env` files, database passwords, access tokens, or other secrets to GitHub.

---

## ⚙️ Local Installation & Setup

### Prerequisites

Install the following:

- Node.js
- npm
- MySQL Server
- Git

### 1. Clone the repository

```bash
git clone https://github.com/AbhinavS0201/TrackItOut.git

cd TrackItOut
```

### 2. Backend setup

```bash
cd backend

npm install
```

Configure the backend environment variables using your project's existing configuration.

Example:

```env
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=expense_tracker

PORT=4000
```

Start the backend using the development script configured in `backend/package.json`:

```bash
npm run dev
```

### 3. Frontend setup

Open another terminal:

```bash
cd frontend

npm install
```

Configure the frontend API URL using the environment variable expected by the existing frontend configuration.

Example:

```env
REACT_APP_API_URL=http://localhost:4000
```

Start the frontend:

```bash
npm start
```

### 4. Database setup

- Install and start MySQL.
- Create the configured database.
- Configure the backend database credentials.
- Apply the project's database migrations or setup instructions.
- Start the backend and frontend.

**Important:** Use the actual environment variable names and database initialization process defined in the project source code. The examples above are configuration illustrations, not replacements for the application's existing setup.

---

## 🛣️ Development Roadmap

TrackItOut is being developed in structured phases.

| Phase | Description | Status |
|---|---|---|
| Phase 1 | Authentication & Application Foundation | Completed |
| Phase 2 | Frontend Shell & Design Foundation | Completed |
| Phase 3 | Advanced Finance Management | Completed |
| Phase 4 | Nutrition Intelligence | Completed |
| Phase 5 | Fitness & Scientific Energy Engine | Completed |
| Phase 6 | Premium UI & Interaction Transformation | Completed |
| Phase 7 | Advanced Analytics & Insights | Planned |
| Phase 8 | Advanced AI Copilot & Agentic Intelligence | Planned |
| Phase 9 | Production Deployment & Launch | Planned |

---

## 🌟 Long-Term Vision

TrackItOut aims to evolve into a unified personal life intelligence platform.

Future development directions include:

- AI-powered expense categorization
- Spending forecasts and anomaly detection
- Advanced nutrition intelligence
- Food recognition and label extraction
- Voice-based activity logging
- Personalized fitness insights
- Intelligent habit recommendations
- Retrieval-Augmented Generation
- Agentic AI workflows
- Cross-domain personal insights
- Progressive Web App (PWA)
- Cloud deployment and synchronization

The long-term objective is to make personal tracking easier, more intelligent, and more connected.

---

## 👨‍💻 Author

**Abhinav Rama**

GitHub: [@AbhinavS0201](https://github.com/AbhinavS0201)

Project Repository: [TrackItOut](https://github.com/AbhinavS0201/TrackItOut)

---

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

<p align="center">

**TrackItOut**

*Your Personal Life Copilot.*

**Track everything. Understand yourself. Improve every day.**

</p>
