import { ComponentFixture, TestBed } from '@angular/core/testing';
import { VampireSurvivorsGameComponent } from './vampire-survivors-game.component';
import { Router } from '@angular/router';

describe('VampireSurvivorsGameComponent', () => {
  let component: VampireSurvivorsGameComponent;
  let fixture: ComponentFixture<VampireSurvivorsGameComponent>;
  let mockRouter: jasmine.SpyObj<Router>;

  beforeEach(async () => {
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);

    await TestBed.configureTestingModule({
      imports: [VampireSurvivorsGameComponent],
      providers: [
        { provide: Router, useValue: mockRouter }
      ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(VampireSurvivorsGameComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('should initialize with MENU state', () => {
    expect(component.gameState).toBe(component.GameState.MENU);
  });

  it('should start game when startGame is called', () => {
    component.startGame();
    expect(component.gameState).toBe(component.GameState.PLAYING);
  });

  it('should navigate to landing when exitToLanding is called', () => {
    component.exitToLanding();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/']);
  });
});
