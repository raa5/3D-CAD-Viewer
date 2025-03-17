import os

# Path to the models directory
MODEL_DIR = "models"  # Adjust the path if needed

# Delete all files in the models directory
for filename in os.listdir(MODEL_DIR):
    file_path = os.path.join(MODEL_DIR, filename)
    if os.path.isfile(file_path):
        os.remove(file_path)
        print(f"Deleted: {file_path}")
    else:
        print(f"Skipping non-file: {file_path}")

print("All files in the models directory have been deleted.")
