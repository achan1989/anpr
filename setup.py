from setuptools import setup, find_packages


packages = find_packages()

setup(
    name='anpr',

    version='0.1.0',

    description='Mucking about with ANPR data',

    url='https://github.com/achan1989/anpr',

    author='as8709, Adrian Chan',

    license='MIT',

    # See https://pypi.python.org/pypi?%3Aaction=list_classifiers
    classifiers=[
        'Development Status :: 3 - Alpha',
        'License :: OSI Approved :: MIT License',
        'Programming Language :: Python :: 3.5',
    ],

    packages=packages,

    install_requires=[
        'openpyxl',
        'psycopg2 >= 2.7',
        'fastkml'
    ],

    entry_points={
        'console_scripts': [
            'anpr = anpr:main'
        ]
    }
)