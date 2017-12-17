import os

from waitress import serve
from pyramid.config import Configurator
from pyramid.response import Response, FileResponse
from pyramid.static import static_view


def main_view(request):
    here = os.path.dirname(__file__)
    page = os.path.join(here, "index.html")
    return FileResponse(page, request)

def start(args):
    with Configurator() as config:
        config.add_route("main", "/")
        config.add_view(main_view, route_name="main")
        config.add_static_view(name='static', path='anpr.web:static')
        config.add_route()
        app = config.make_wsgi_app()
    serve(app, host='127.0.0.1', port=8000)
