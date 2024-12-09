PYTHON=python

run:
	$(PYTHON) manage.py runserver

migrations:
	$(PYTHON) manage.py makemigrations
	$(PYTHON) manage.py migrate 
