from django.urls import path
from . import views

urlpatterns = [
    path('', views.task_list, name='task_list'),
    path('start_timer/<int:task_id>/', views.start_timer, name='start_timer'),
    path('stop_timer/', views.stop_timer, name='stop_timer'),
    path('reset_deadlines/', views.reset_deadlines, name='reset_deadlines'),
]
