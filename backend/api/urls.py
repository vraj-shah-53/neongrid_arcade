from django.urls import path
from . import views

urlpatterns = [
    # Single Player / AI endpoints
    path('tictactoe/move/', views.tictactoe_move, name='tictactoe_move'),
    path('scribbles/prompt/', views.scribbles_prompt, name='scribbles_prompt'),
    path('eightpuzzle/solve/', views.eightpuzzle_solve, name='eightpuzzle_solve'),
    path('zip/generate/', views.zip_generate, name='zip_generate'),
    path('sudoku/generate/', views.sudoku_generate, name='sudoku_generate'),
    path('sudoku/solve/', views.sudoku_solve, name='sudoku_solve'),
    path('typing/passage/', views.typing_passage, name='typing_passage'),

    # Multiplayer Authentication
    path('auth/register/', views.auth_register, name='auth_register'),
    path('auth/login/', views.auth_login, name='auth_login'),
    path('auth/logout/', views.auth_logout, name='auth_logout'),
    path('auth/user/', views.get_profile, name='get_profile'),

    # Multiplayer Challenges
    path('challenges/send/', views.send_challenge, name='send_challenge'),
    path('challenges/list/', views.list_challenges, name='list_challenges'),
    path('challenges/respond/', views.respond_challenge, name='respond_challenge'),

    # Real-Time Game Rooms
    path('room/<uuid:room_id>/state/', views.get_room_state, name='get_room_state'),
    path('room/<uuid:room_id>/move/', views.make_room_move, name='make_room_move'),
    path('room/<uuid:room_id>/draw/', views.room_draw, name='room_draw'),
    path('room/<uuid:room_id>/abandon/', views.abandon_room, name='abandon_room'),
]
