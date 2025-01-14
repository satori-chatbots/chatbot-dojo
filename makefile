PYTHON=python
BACKEND_DIR=backend
FRONTEND_DIR=frontend
FILEVAULT=filevault
MANAGE=$(BACKEND_DIR)/manage.py

full_reset:
	rm $(BACKEND_DIR)/db.sqlite3
	rm -rf $(FILEVAULT)/executed_yaml/
	rm -rf $(FILEVAULT)/results/
	find $(BACKEND_DIR) -path "*/migrations/*.py" -not -name "__init__.py" -delete
	find $(BACKEND_DIR) -path "*/migrations/*.pyc"  -delete
	$(PYTHON) $(MANAGE) makemigrations tester
	$(PYTHON) $(MANAGE) makemigrations
	$(PYTHON) $(MANAGE) migrate

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
