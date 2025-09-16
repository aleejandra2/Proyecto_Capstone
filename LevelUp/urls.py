from django.urls import path
from .views import register_view, login_view, logout_view, home_view

urlpatterns = [
    path('', home_view, name='home'),
    path("ingresar/", login_view, name="login"),
    path("registro/", register_view, name="register"),
    path("salir/", logout_view, name="logout"),
]
