# 🌳 Verdifica

### Open Digital Infrastructure for Forest Product Traceability

**Digital Public Infrastructure (DPI) | Environmental Monitoring | Geospatial Intelligence | Open Source**

> **Our mission:** Make environmental traceability more accessible to small-scale forest producers through open technology, satellite-based analysis, and transparent digital evidence.

---

## Project Information

| Field | Details |
|---|---|
| **Solution Name** | Verdifica |
| **Team Name** | Group 6 |
| **Country** | Brazil |
| **Development Stage** | Hackathon Prototype / Minimum Viable Product (MVP) |
| **Project Category** | Digital Public Infrastructure (DPI) |
| **Target Audience** | Small-scale forest producers, cooperatives, buyers, and public institutions |
| **Main Technologies** | React, Python, FastAPI, Google Earth Engine, Sentinel-2 |
| **Development Approach** | Open-source and interoperable architecture |

## Meet Our Team — Group 6

Verdifica was developed by five team members working together to promote environmental sustainability, digital inclusion, and more transparent supply chains.

| Team Member | Email | LinkedIn |
|---|---|---|
| **Giovanna Franco de Carvalho** | giovanna.francoc@outlook.com | Giovanna Franco — URL not provided |
| **Victor Augusto Toledo Lúcio Borghi** | victoraugustoborghi082@gmail.com | [LinkedIn](https://www.linkedin.com/in/victorborghi) |
| **Thales Prado Rocha dos Santos** | thalesprocha44@gmail.com | Thales Prado — URL not provided |
| **Rafael Hoki Kuntz** | rafael.hoki@gmail.com | [LinkedIn](https://www.linkedin.com/in/rafael-hoki-05a15043b/) |
| **Thiago Silva de Almeida** | thiagoalmeida0250@gmail.com | Not provided |

---

## Prototype Access

**Prototype Link:** [INSERT GITHUB REPOSITORY URL]

**Important — Local Execution:** Verdifica currently runs in a local development environment and is not publicly hosted. The repository provides access to the source code and project documentation rather than a live application. Reviewers must download the project, install its dependencies, and run the frontend and backend locally.

Live satellite analysis requires Google Earth Engine authentication and an authorized Google Cloud project.

---

## 1. The Problem

Small-scale forest producers often face significant challenges when trying to demonstrate the origin of their products and provide environmental information to buyers, companies, ports, and public institutions.

Existing traceability and environmental monitoring systems can be expensive, fragmented, technically complex, and difficult to access.

These barriers can limit opportunities for producers to participate in responsible supply chains, even when they are willing to provide information about their activities.

Meanwhile, institutions and companies need reliable, standardized, and transparent environmental information to support their verification processes.

**The challenge is to make environmental traceability accessible, transparent, and interoperable without creating additional technological barriers for small producers.**

## 2. Our Solution

**Verdifica** is an open-source digital platform designed to support forest product traceability through field data collection, satellite-based environmental screening, and standardized technical reporting.

The solution allows producers to register products, capture photographs, collect GPS coordinates, and associate their records with declared production areas.

Its backend uses satellite imagery and geospatial analysis to identify potential changes in vegetation and land cover over time.

The system consolidates the results into environmental reports and supports experimental traceability decisions.

In favorable demonstration scenarios, Verdifica can generate an experimental traceability token that links a product record to supporting information.

**Verdifica does not issue official environmental certifications, validate legal permits, or independently prove that a product was legally sourced.** It provides preliminary technical evidence to support further verification.

## 3. How Verdifica Works

Verdifica follows four main stages:

### Stage 1 — Field Data Collection

The producer registers a forest product through the application.

The registration workflow can include:

- Product type and description.
- Product quantity.
- Product photograph.
- GPS coordinates.
- Declared production location.
- Registration information.

The objective is to organize the product's declared origin and supporting information in a digital record.

### Stage 2 — Satellite and Geospatial Analysis

The backend analyzes satellite imagery and geographic data to identify potential vegetation and land-cover changes.

The analysis combines:

- **Sentinel-2:** Satellite imagery for multitemporal monitoring.
- **Google Dynamic World:** Machine-learning-based land-cover classification.
- **NDVI:** Vegetation condition indicators.
- **GeoJSON:** Geographic boundaries and spatial comparisons.
- **Amazônia-1:** Complementary Brazilian satellite research.

The system can compare environmental conditions across different periods and assess changes inside and outside a declared geographic polygon.

Satellite indicators support environmental screening but cannot independently establish illegal deforestation or legal compliance.

### Stage 3 — Environmental Assessment and Evidence

The platform processes the analysis results and organizes technical evidence.

Depending on the available information, the assessment may identify:

- No divergence detected within the analyzed scenario.
- Potential environmental divergence requiring further review.
- Insufficient evidence for a reliable assessment.

Supporting evidence may include satellite images, vegetation indicators, land-cover classifications, maps, JSON responses, and PDF reports.

### Stage 4 — Traceability and Information Sharing

When a demonstration scenario meets the configured conditions, the application can generate an experimental traceability token.

The long-term objective is to enable authorized stakeholders to access relevant evidence associated with a product registration.

Future integrations could support information exchange with cooperatives, companies, ports, and public institutions.

**The experimental token is not an official certificate or a guarantee of product authenticity, legal origin, or environmental compliance.**

## 4. System Architecture

```text
                  SMALL-SCALE PRODUCER
                           |
                           v
                  REACT APPLICATION
                Product Registration
                Photo Capture + GPS
                           |
                           v
                      FASTAPI
                    Python Backend
                           |
             +-------------+-------------+
             |                           |
             v                           v
      GEOSPATIAL ANALYSIS          IMAGE VALIDATION
      Google Earth Engine          File and Resolution
             |                           |
             v                           v
      Sentinel-2 / NDVI           Demonstration Mode
      Dynamic World               No Visual AI Verification
             |                           |
             +-------------+-------------+
                           |
                           v
                 ENVIRONMENTAL REPORT
                  JSON + Maps + PDF
                           |
                           v
                  SCREENING DECISION
                           |
               +-----------+-----------+
               |                       |
               v                       v
        FAVORABLE DEMO            POTENTIAL ALERT
           SCENARIO               OR INSUFFICIENT
               |                     EVIDENCE
               v                       |
       EXPERIMENTAL TOKEN              v
                                FURTHER REVIEW
```

The architecture is modular and designed to support future integrations with public digital services.

## 5. Technology Stack

| Component | Technology | Purpose |
|---|---|---|
| Frontend | React | Producer interface and product registration |
| Backend | Python / FastAPI | API services and environmental processing |
| Satellite Processing | Google Earth Engine | Geospatial analysis |
| Satellite Imagery | Sentinel-2 | Vegetation and land-cover monitoring |
| Land-Cover Classification | Google Dynamic World | Land-cover change indicators |
| Vegetation Analysis | NDVI | Vegetation condition comparison |
| Additional Satellite Research | Amazônia-1 / INPE | Complementary Earth observation research |
| Image Validation | Pillow | Image file and resolution validation |
| Report Generation | ReportLab | Environmental PDF reports |
| Geographic Data | GeoJSON | Declared production area boundaries |
| Local Storage | IndexedDB | Frontend registration records |
| Data Exchange | REST APIs / JSON | Interoperability |

### Artificial Intelligence and Environmental Monitoring

Verdifica uses satellite-derived environmental information, including machine-learning-based land-cover classifications from Google Dynamic World.

The prototype compares satellite observations across different periods to identify potential changes in vegetation and land cover.

The photograph endpoint currently operates in demonstration mode. It validates uploaded image files but does not perform AI-based product recognition, image authenticity verification, or GPS verification.

These capabilities are potential future developments.

## 6. Digital Public Infrastructure (DPI)

Verdifica is designed as a potential reusable component of **Digital Public Infrastructure (DPI)**.

Rather than creating an isolated verification platform, the project explores how open digital components can support environmental traceability across different organizations and regions.

The architecture emphasizes:

| Principle | Verdifica's Approach |
|---|---|
| **Interoperability** | Standardized REST APIs, JSON responses, and GeoJSON data |
| **Openness** | Open-source development and reusable components |
| **Digital Inclusion** | Accessible workflows designed for small-scale producers |
| **Transparency** | Documented environmental indicators and technical evidence |
| **Scalability** | Potential adaptation to other biomes and countries |
| **Governance** | Future integration with authorized institutions and public registries |
| **Trust** | Evidence-based assessments and planned auditability mechanisms |

### Regional Scalability

Although Verdifica was initially developed with the Brazilian forest context in mind, its modular architecture is intended to support adaptation to other ecosystems.

Future implementations could integrate different satellite sources, environmental databases, regulatory requirements, and institutional systems.

This creates opportunities for expansion across South America.

**Verdifica is currently a DPI-oriented prototype, not an officially deployed government infrastructure.**

## 7. Data Security and Privacy

**Protecting producer information is a fundamental design priority.**

Verdifica may process product records, photographs, GPS coordinates, geographic boundaries, and environmental reports.

Some of this information may be personal, commercially sensitive, or capable of revealing a producer's location and activities.

The MVP supports local frontend storage and environment-based configuration for backend credentials.

### Security Measures and Planned Improvements

| Security Area | Approach |
|---|---|
| **Data Minimization** | Collect only information necessary for product registration and environmental analysis |
| **Geolocation Privacy** | Restrict exposure of precise producer coordinates |
| **Authentication** | Implement secure user accounts and role-based access control |
| **Encryption** | Use HTTPS and encryption for sensitive stored data in production |
| **API Security** | Validate inputs, restrict file uploads, and introduce rate limiting |
| **Token Integrity** | Develop cryptographically signed records and secure token verification |
| **Auditability** | Record important changes, access events, and verification decisions |
| **Regulatory Compliance** | Align future deployments with Brazil's LGPD and applicable data protection laws |

### Current Security Limitations

Verdifica is a hackathon MVP and has not undergone an independent security audit.

Production-grade authentication, authorization, encryption at rest, secure multi-user data storage, and formal privacy governance remain implementation priorities.

Sensitive credentials must never be committed to public repositories.

Precise producer locations and personal records should not be publicly exposed without appropriate authorization and safeguards.

## 8. Current MVP Features

The prototype includes:

- Product registration and photograph capture workflows.
- GPS collection.
- A FastAPI backend with documented endpoints.
- Sentinel-2 satellite analysis.
- Dynamic World land-cover classification.
- NDVI-based vegetation indicators.
- Geographic comparison of changes inside and outside declared polygons.
- Experimental Amazônia-1 analysis.
- Demonstration environmental permission records.
- Satellite image visualizations.
- Structured JSON environmental reports.
- PDF report generation.
- Image upload and basic file validation.
- Experimental traceability decision logic.

Some environmental permissions and demonstration scenarios use fictional or simulated data.

Full frontend-to-backend integration requires final end-to-end validation.

## 9. Running Verdifica Locally

### Prerequisites

To run the project locally, you will need:

- Python 3.
- Node.js and npm.
- A Google Earth Engine account for live satellite processing.
- An authorized Google Cloud project.
- The project's backend and frontend dependencies.

### Backend Setup

Open a terminal and navigate to the backend directory:

```bash
cd backend
```

Create and activate a virtual environment:

```bash
python3 -m venv .venv
source .venv/bin/activate
```

Install the required dependencies:

```bash
pip install -r requirements.txt
```

Configure the environment variables using the repository's `.env.example` file, if provided.

Authenticate with Google Earth Engine:

```bash
earthengine authenticate
```

Start the FastAPI server:

```bash
python -m uvicorn api.main:app --reload
```

The backend should be available at:

`http://127.0.0.1:8000`

Interactive API documentation:

`http://127.0.0.1:8000/docs`

### Frontend Setup

Navigate to the frontend directory and install the dependencies:

```bash
npm install
```

Start the React development server using the script defined in the frontend's `package.json`.

For a Vite-based React application:

```bash
npm run dev
```

Configure the frontend to communicate with the locally running FastAPI backend.

The exact frontend directory and startup command should be checked against the final repository structure.

### Important Notes

- Verdifica currently runs locally.
- Live satellite processing requires Google Earth Engine authentication.
- Demonstration scenarios may use simulated data.
- The prototype is not an official environmental verification service.
- Real producer data should not be used without appropriate privacy and security safeguards.

## 10. Expected Impact

Verdifica aims to reduce technological barriers to environmental traceability and improve access to environmental information.

Potential long-term benefits include:

- Greater access to traceability tools for small-scale producers.
- Better organization of product provenance evidence.
- Increased transparency across forest product supply chains.
- Easier exchange of standardized information between institutions.
- Reusable digital infrastructure for environmental services.
- Opportunities for adaptation across South American countries and biomes.

The project seeks to support a more inclusive digital ecosystem in which environmental information can be shared responsibly and transparently.

## 11. Future Development

The next development priorities include:

1. Completing and validating frontend-backend integration.
2. Implementing production-grade authentication and authorization.
3. Strengthening data privacy, encryption, and security monitoring.
4. Connecting official environmental and land-use databases.
5. Improving photograph authenticity and evidence verification.
6. Implementing secure and verifiable traceability tokens.
7. Expanding offline-first capabilities.
8. Testing the platform with real producers and institutional partners.
9. Exploring deployment across different biomes and countries.

## 12. Our Vision

We believe environmental traceability should not be limited to organizations with extensive financial resources or specialized technical infrastructure.

Verdifica explores how open-source technology, satellite-derived environmental information, and interoperable digital services can help make traceability more accessible to small-scale forest producers.

Our long-term ambition is to contribute reusable components to a trustworthy, inclusive, and scalable Digital Public Infrastructure ecosystem.

---

### 🌳 Verdifica — Group 6

**Connecting forest producers, environmental evidence, and digital trust.**

*Developed in Brazil. Designed for inclusion. Built with the ambition to scale across South America.*
