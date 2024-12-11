import os
import subprocess
import time
from django.shortcuts import render, redirect, get_object_or_404
from .forms import *
from .models import *

def upload_file(request):
    if request.method == 'POST':
        form = TestCaseForm(request.POST)
        file_form = TestFileForm(request.POST, request.FILES)
        files = request.FILES.getlist('file')
        if form.is_valid() and file_form.is_valid():
            test_case_instance = form.save(commit=False)
            test_case_instance.save()

            for f in files:
                test_file_instance = TestFile(file=f, test_case=test_case_instance)
                test_file_instance.save()

            # Directory of the uploaded files' directory
            file_path = os.path.dirname(test_file_instance.file.path)

            # Base directory of the Django project
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
            print("Base dir:")
            print(base_dir)
            # Relative path to the autotest script
            script_path = os.path.join(base_dir, 'user-simulator/src/autotest.py')
            # Setup CWD user-simulator
            cwd = os.chdir(os.path.dirname(os.path.dirname(script_path)))


            # Directory for --extract
            extract_dir = os.path.dirname(file_path)

            print("File path:")
            print(file_path)


            try:
                # Debugging output
                print(f"Running script at: {script_path}")
                print(f"Using user profile: {file_path}")
                print(f"Extracting to: {extract_dir}")

                start_time = time.time()

                result = subprocess.run(
                    ['python', script_path,
                    '--technology', 'taskyto',
                    '--chatbot', 'http://127.0.0.1:5000',
                    '--user', file_path,
                    '--extract', extract_dir],
                    # Set as cwd the /user-simulator/
                    cwd=cwd,
                    capture_output=True,
                    text=True,
                )

                end_time = time.time()
                elapsed_time = end_time - start_time
                test_case_instance.execution_time = round(elapsed_time, 2)

                # Debugging subprocess output
                print(f"STDOUT: {result.stdout}")
                print(f"STDERR: {result.stderr}")

                test_case_instance.result = result.stdout
                test_case_instance.save()

            except FileNotFoundError as e:
                print(f"File not found: {e}")
                test_case_instance.result = f"Error: {e}"
                test_case_instance.save()

            except Exception as e:
                print(f"Error running script: {e}")
                test_case_instance.result = f"Error: {e}"
                test_case_instance.save()

            return redirect('results', pk=test_case_instance.id)
    else:
        form = TestFileForm()
    return render(request, 'upload.html', {'form': form})

def show_results(request, pk):
    test_case = get_object_or_404(TestCase, pk=pk)
    execution_time = test_case.execution_time
    hours = int(execution_time // 3600)
    minutes = int(execution_time // 60 % 60)
    seconds = round(execution_time % 60, 2)
    if hours > 0:
        formatted_time = f"{hours} hours, {minutes} minutes and {seconds} seconds"
    elif minutes > 0:
        formatted_time = f"{minutes} minutes and {seconds} seconds"
    else:
        formatted_time = f"{seconds} seconds"
    return render(request, 'results.html', {
        'test_case': test_case,
        'formatted_time': formatted_time
    })
