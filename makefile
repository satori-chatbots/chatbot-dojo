PYTHON=python

run:
	$(PYTHON) manage.py runserver

migrations:
	$(PYTHON) manage.py makemigrations
	$(PYTHON) manage.py migrate 

clean:
	find . -path "*/migrations/*.py" -not -name "__init__.py" -delete
	find . -path "*/migrations/*.pyc"  -delete

dropdb:
	rm db.sqlite3

clear_uploads:
	rm -rf uploads/*

clear_results:
	rm -rf test-results/*
