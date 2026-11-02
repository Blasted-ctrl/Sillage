# Sillage API

The default FastAPI service indexes the checked-in fragrance CSV and runs weighted TF-IDF cosine retrieval locally. Supabase credentials and a downloaded sentence transformer are not required.

See the [project README](../README.md) for setup, request examples, optional gradient-descent training, evaluation limits and deployment configuration.

```bash
pip install -r requirements-dev.txt
python -m uvicorn api:app --reload
```

The legacy scraping, cleaning and embedding/upload scripts remain separate experiments. Their dependencies and external services are not included in the runtime requirements.
