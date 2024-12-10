import os
import subprocess
import time
from django.shortcuts import render, redirect, get_object_or_404
from .forms import TestFileForm
from .models import TestFile

def upload_file(request):
    if request.method == 'POST':
        form = TestFileForm(request.POST, request.FILES)
        if form.is_valid():
            test_file = form.save()  # Save the uploaded file
            file_path = test_file.file.path  # Path to the uploaded YAML file
            # Base directory of the Django project
            base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
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
                test_file.execution_time = round(elapsed_time, 2)

                # Debugging subprocess output
                print(f"STDOUT: {result.stdout}")
                print(f"STDERR: {result.stderr}")

                test_file.result = result.stdout
                test_file.save()

            except FileNotFoundError as e:
                print(f"File not found: {e}")
                test_file.result = f"Error: {e}"
                test_file.save()

            except Exception as e:
                print(f"Error running script: {e}")
                test_file.result = f"Error: {e}"
                test_file.save()

            return redirect('results', pk=test_file.id)
    else:
        form = TestFileForm()
    return render(request, 'upload.html', {'form': form})

def show_results(request, pk):
    test_file = get_object_or_404(TestFile, pk=pk)
    execution_time = test_file.execution_time
    hours = int(execution_time // 3600)
    minutes = int(execution_time // 60)
    seconds = round(execution_time % 60, 2)
    if hours > 0:
        formatted_time = f"{hours} hours, {minutes} minutes and {seconds} seconds"
    elif minutes > 0:
        formatted_time = f"{minutes} minutes and {seconds} seconds"
    else:
        formatted_time = f"{seconds} seconds"
    return render(request, 'results.html', {
        'test_file': test_file,
        'formatted_time': formatted_time
    })
