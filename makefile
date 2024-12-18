PYTHON=python
BACKEND_DIR=backend
FRONTEND_DIR=frontend
MANAGE=$(BACKEND_DIR)/manage.py

run:
	$(PYTHON) $(MANAGE) runserver

migrations:
	$(PYTHON) $(MANAGE) makemigrations tester
	$(PYTHON) $(MANAGE) makemigrations
	$(PYTHON) $(MANAGE) migrate

clean:
	find $(BACKEND_DIR) -path "*/migrations/*.py" -not -name "__init__.py" -delete
	find $(BACKEND_DIR) -path "*/migrations/*.pyc"  -delete

dropdb:
	rm $(BACKEND_DIR)/db.sqlite3

pull-submodules:
	git pull --recurse-submodules

npm-install:
	cd $(FRONTEND_DIR) && npm install

npm-dev:
	cd $(FRONTEND_DIR) && npm run dev
