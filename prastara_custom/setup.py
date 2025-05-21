from setuptools import setup, find_packages

with open("requirements.txt") as f:
	install_requires = f.read().strip().split("\n")

# get version from __version__ variable in qcshr/__init__.py
from prastara_custom import __version__ as version

setup(
	name="prastara_custom",
	version=version,
	description="Prastara Custom",
	author="Prastara Custom",
	author_email="anjana@ihgind.com",
	packages=find_packages(),
	zip_safe=False,
	include_package_data=True,
	install_requires=install_requires
)
