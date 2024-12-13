# sensei-web

A web server for sensei

## Installation

To update this repo, since it depends on the `user-simulator` we have to make a git pull like this:

```bash
git pull --recurse-submodules
```
or 

```bash
make pull-submodules
```

If you want to do it automatically you can add this to your config:

```bash
git config submodule.recurse true
```

First of all, we need to have this project cloned and the `user-simulator` project cloned as well. Also, they should be at the same level in the directory tree. For example:

```bash
miso/
├── user-simulator/
└── sensei-web/
```

To make the server run, you need to have the project dependencies installed, but also the `user-simulator` ones. To do so, in a preferabily new virtual environment, run the following commands:

```bash
pip install -r requirements.txt
pip install -r ../user-simulator/requirements.txt
```

After that, you can make the necessary migrations and then execute the server:

```bash
make migrations
make run
```

In case of problems, I suggest deleting the migrations and the database file and then running the migrations again:

```bash
make clean
make dropdb
make migrations
make run
```

## Usage

For now, the server is very simple, it is configured to work with `Taskyto` so it must be running at `http://127.0.0.1:5000`. Then, the server is running at `http://127.0.0.1:8000`, you can access it through your browser, upload a file and the results will get saved in the `uploads` folder.

The next step is to display the results in screen, also, to store things in a database.
