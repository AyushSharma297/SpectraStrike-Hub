# Contributing to SpectraStrike Hub

Thank you for your interest in contributing to SpectraStrike Hub! We welcome contributions from the community, whether it's bug fixes, feature enhancements, documentation improvements, or code reviews.

## Code of Conduct

Please note that this project is governed by our [Code of Conduct](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Getting Started

### Prerequisites

- **Python 3.9+** (backend)
- **Node.js 18+** (frontend)
- **npm 9+** or **yarn**
- **pip** (Python package manager)
- Git

### Local Development Setup

#### 1. Clone the Repository

```bash
git clone https://github.com/AyushSharma297/SpectraStrike-Hub.git
cd SpectraStrike-Hub
```

#### 2. Backend Setup

```bash
cd backend
pip install -r requirements.txt
python main.py
```

The backend API will be available at `http://localhost:8000`

#### 3. Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

The frontend dev server will be available at `http://localhost:5173`

### Running Tests

#### Frontend Tests

```bash
cd frontend
npm run build  # Verify production build with zero warnings
```

#### Backend Validation

```bash
cd backend
# Verify the application starts without errors
python main.py
```

## Development Workflow

### 1. Create a Branch

Create a feature or fix branch from `main`:

```bash
git checkout -b feature/your-feature-name
# or
git checkout -b fix/your-bug-fix-name
```

### 2. Make Your Changes

- Write clear, maintainable code
- Follow the project's coding style (see below)
- Keep commits small and focused
- Write descriptive commit messages

### 3. Commit with Conventional Commits

Use conventional commit format:

```
feat: add device discovery for new protocol
fix: resolve memory leak in sync loop
docs: update API documentation
style: fix CSS linting issues
test: add integration tests for group control
chore: update dependencies
```

### 4. Verify Your Work

Before pushing, ensure:

- **Frontend**: `npm run build` completes with zero errors and warnings
- **Backend**: Application starts and key endpoints respond correctly
- No dead code or unused imports (except intentional stubs)

### 5. Push and Create a Pull Request

```bash
git push origin feature/your-feature-name
```

Then open a pull request on GitHub with:
- Clear description of what changed
- Reference any related issues (`Fixes #123`)
- Screenshots (for UI changes)
- Test results or evidence of validation

## Coding Standards

### Python (Backend)

- Follow [PEP 8](https://www.python.org/dev/peps/pep-0008/)
- Use 4-space indentation
- Use `black` formatter where applicable
- Type hints are encouraged
- Keep functions focused and readable

### JavaScript / React (Frontend)

- Use 2-space indentation
- Prefer functional components with hooks
- Keep components small and focused
- Use meaningful variable and component names
- Document complex logic with comments

### CSS / Styling

- Follow BEM or utility-first naming conventions
- Use 2-space indentation
- Vendor prefixes should come before standard properties
- Keep vendor-specific rules organized

## Project Structure

```
wled-wiz-hub/
├── backend/
│   ├── main.py              # FastAPI application entry point
│   ├── wiz.py               # WiZ protocol implementation
│   ├── wled.py              # WLED protocol implementation
│   ├── pc_lights.py         # OpenRGB and Dynamic Lighting integration
│   ├── screen_sync.py       # Screen color synchronization
│   ├── scanner.py           # Device discovery
│   ├── requirements.txt      # Python dependencies
│   └── hub_data.json        # Persistent state (auto-created)
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main React component (2700+ lines)
│   │   ├── index.css        # Global styles with glassmorphism
│   │   ├── main.jsx         # React entry point
│   │   └── assets/          # Static assets
│   ├── package.json
│   ├── vite.config.js
│   └── public/
│
├── LICENSE                  # Apache 2.0 License
├── README.md               # Project overview
├── CONTRIBUTING.md         # This file
├── CODE_OF_CONDUCT.md      # Community guidelines
├── SECURITY.md             # Security policy
└── run.bat                 # Windows convenience script
```

## Feature Development Checklist

When implementing new features:

- [ ] Backend API endpoints added and tested
- [ ] Frontend UI components created
- [ ] CSS styles follow glassmorphism theme
- [ ] State management integrated (React hooks)
- [ ] Error handling and validation added
- [ ] No console errors or warnings
- [ ] Build succeeds (`npm run build`)
- [ ] Tested on both WLED and WiZ devices (if protocol-specific)
- [ ] Documentation updated
- [ ] PR description includes motivation and testing details

## Bug Reports

When reporting bugs:

1. Check if the issue already exists
2. Include:
   - Steps to reproduce
   - Expected behavior
   - Actual behavior
   - Environment (OS, browser, Python version)
   - Relevant error messages or logs

## Feature Requests

When suggesting features:

1. Describe the use case and benefit
2. Explain how it fits the project vision
3. Suggest implementation approach (if you have ideas)
4. Include wireframes or mockups (for UI features)

## Questions or Discussions

For questions about the codebase or architecture:
- Open a [GitHub Discussion](https://github.com/AyushSharma297/SpectraStrike-Hub/discussions)
- Review existing documentation first

## Security Issues

**Do not** create public issues for security vulnerabilities. Please follow our [Security Policy](SECURITY.md).

## Recognition

Contributors will be recognized in the project's README and commit history. Thank you for making SpectraStrike Hub better!

---

Happy coding! 🎨✨
