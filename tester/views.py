import subprocess
import yaml
from django.shortcuts import render, redirect
from .forms import TestFileForm
from .models import TestFile

def upload_file(request):
    if request.method == 'POST':
        form = TestFileForm(request.POST, request.FILES)
        if form.is_valid():
            test_file = form.save()  # Save the uploaded file
            # Process the file with your script
            file_path = test_file.file.path
            try:
                result = subprocess.run(
                    ['python', 'autotest.py', file_path],
                    capture_output=True,
                    text=True,
                )
                test_file.result = result.stdout
                test_file.save()
            except Exception as e:
                test_file.result = f"Error running script: {e}"
                test_file.save()
            return redirect('results', pk=test_file.id)
    else:
        form = TestFileForm()
    return render(request, 'upload.html', {'form': form})

def show_results(request, pk):
    test_file = TestFile.objects.get(pk=pk)
    return render(request, 'results.html', {'file': test_file})
