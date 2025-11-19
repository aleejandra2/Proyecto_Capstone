from django.urls import path
from . import views

urlpatterns = [
    path("recompensas/", views.recompensas, name="recompensas"),
]
